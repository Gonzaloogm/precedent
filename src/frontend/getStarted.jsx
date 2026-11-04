import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Link,
  List,
  ListItem,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  xcss,
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

const card = xcss({ padding: 'space.300', borderRadius: 'border.radius', backgroundColor: 'elevation.surface.sunken' });
const selectBox = xcss({ width: '320px' });

async function call(name, payload) {
  try {
    return await invoke(name, payload);
  } catch (err) {
    console.error(name, err);
    return { ok: false, error: 'This step did not finish. Run it again: finished parts are kept.' };
  }
}

function Message({ result }) {
  if (!result) return null;
  return (
    <SectionMessage appearance={result.error ? 'error' : 'success'} title={result.title}>
      <Stack space="space.100">
        {result.error && <Text>{result.error}</Text>}
        {result.lines?.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
        {result.links?.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </Stack>
    </SectionMessage>
  );
}

function Progress({ step }) {
  if (!step) return null;
  return (
    <Inline space="space.100" alignBlock="center">
      <Spinner size="small" label={step} />
      <Text>{step}…</Text>
    </Inline>
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [context, setContext] = useState(null);
  const [step, setStep] = useState(null);
  const [confluenceResult, setConfluenceResult] = useState(null);
  const [jiraResult, setJiraResult] = useState(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    invoke('sampleStatus').then(setStatus).catch(() => setStatus({ projects: [], jira: 'missing' }));
    view.getContext().then(setContext).catch(() => setContext({}));
  }, []);

  const siteUrl = context?.siteUrl || '';
  const busy = Boolean(step);
  const projects = status?.projects || [];

  const loadConfluence = async () => {
    setConfluenceResult(null);
    setStep('Creating the Confluence space');
    const space = await call('seedSpace');
    if (!space.ok) {
      setStep(null);
      return setConfluenceResult({ title: 'The sample space could not be created', error: space.error });
    }
    setStep('Writing company history and the proposal');
    const pages = await call('seedPages');
    setStep(null);
    if (!pages.ok) return setConfluenceResult({ title: 'Some pages are missing', error: pages.error });
    setStatus((s) => ({ ...s, space: { url: space.spaceUrl } }));
    setConfluenceResult({
      title: 'Brightpath Clinics is ready in Confluence',
      lines: [
        pages.pagesCreated ? `${pages.pagesCreated} pages created.` : 'All pages were already there.',
        'Next: open the AI scheduling proposal and ask SF Market Research to stress-test it.',
      ],
      links: [
        ...(pages.proposalUrl ? [{ href: pages.proposalUrl, label: 'Open the AI scheduling proposal' }] : []),
        { href: space.spaceUrl, label: 'Open the sample space' },
      ],
    });
  };

  const loadJira = async () => {
    if (!project) return;
    setJiraResult(null);
    let created = 0;
    const errors = [];
    const total = status?.epicCount || 3;
    for (let i = 0; i < total; i += 1) {
      setStep(`Adding past initiatives to ${project.value} (${i + 1}/${total})`);
      const epic = await call('seedJiraEpic', { projectKey: project.value, index: i });
      if (!epic.ok) errors.push(epic.error);
      created += epic.issuesCreated || 0;
    }
    setStep(null);
    const jql = encodeURIComponent(`labels = sprintfounders-sample ORDER BY created ASC`);
    setJiraResult({
      title: errors.length ? 'Some work items could not be created' : `Past initiatives added to ${project.value}`,
      error: errors[0],
      lines: [created ? `${created} work items created, all marked as done.` : 'The sample work items were already there.'],
      links: siteUrl ? [{ href: `${siteUrl}/issues/?jql=${jql}`, label: 'See them in Jira' }] : [],
    });
  };

  return (
    <Stack space="space.300">
      <Heading as="h2">A skeptical committee that remembers what your company already tried</Heading>
      <Text>
        SprintFounders reviews new initiatives and budget requests before anyone spends a cent. Its Rovo agents read the
        proposal, check it against your company's own history in Confluence and Jira, answer the team's objections and
        turn an approved plan into a Jira epic.
      </Text>

      <Box xcss={card}>
        <Stack space="space.150">
          <Heading as="h3">1. Load a sample company (optional)</Heading>
          <Text>
            Creates a fictional clinic network, Brightpath Clinics: past retros and decisions in a new Confluence space,
            plus one proposal ready to review. Nothing is sent outside Atlassian. Safe to run twice.
          </Text>
          {status?.space && !confluenceResult && (
            <Text>
              Already loaded: <Link href={status.space.url}>open the sample space</Link>.
            </Text>
          )}
          <Box>
            <Button appearance="primary" onClick={loadConfluence} isDisabled={busy}>
              {status?.space ? 'Load it again (fills in anything missing)' : 'Load sample company'}
            </Button>
          </Box>
          <Message result={confluenceResult} />

          {status && status.jira !== 'missing' && (
            <Stack space="space.100">
              <Text>
                Optional: add the company's past initiatives to Jira as finished epics, so the precedent check finds
                work items too. Pick a project you can create work items in (a test project is best).
              </Text>
              {projects.length ? (
                <Inline space="space.100" alignBlock="center">
                  <Box xcss={selectBox}>
                    <Select
                      inputId="sample-project"
                      placeholder="Choose a Jira project"
                      options={projects.map((p) => ({ label: `${p.name} (${p.key})`, value: p.key }))}
                      value={project}
                      onChange={setProject}
                    />
                  </Box>
                  <Button onClick={loadJira} isDisabled={busy || !project}>
                    Add history to Jira
                  </Button>
                </Inline>
              ) : (
                <Text>Create any Jira project first (for example "Brightpath Initiatives"), then reload this page.</Text>
              )}
              <Message result={jiraResult} />
            </Stack>
          )}
          <Progress step={step} />
        </Stack>
      </Box>

      <Box xcss={card}>
        <Stack space="space.150">
          <Heading as="h3">2. Review a proposal</Heading>
          <List type="ordered">
            <ListItem>
              <Text>Open a proposal page and open Rovo chat.</Text>
            </ListItem>
            <ListItem>
              <Text>SF Market Research: customer, market, risks and what your company already tried.</Text>
            </ListItem>
            <ListItem>
              <Text>Challenge any assumption with a page comment.</Text>
            </ListItem>
            <ListItem>
              <Text>SF Devil's Advocate: rules on every objection and gives GO, PIVOT or STOP.</Text>
            </ListItem>
            <ListItem>
              <Text>On GO or PIVOT, approve the draft and it creates the Jira epic and stories.</Text>
            </ListItem>
          </List>
          <Text>Nothing is saved or created without your confirmation.</Text>
        </Stack>
      </Box>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
