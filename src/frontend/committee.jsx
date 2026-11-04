import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Link,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  xcss,
} from '@forge/react';
import { invoke, rovo, view } from '@forge/bridge';

const AGENT = { type: 'forge', agentKey: 'devils-advocate-agent', agentName: "SF Devil's Advocate" };
const VERDICT_LOOK = { GO: 'success', PIVOT: 'moved', STOP: 'removed' };
const GATE_LOOK = { done: 'success', missed: 'removed', open: 'default' };
const RULING_LOOK = { upheld: 'success', 'partly upheld': 'moved', rejected: 'default', noted: 'default' };
const panel = xcss({ padding: 'space.200', width: '100%' });
const row = xcss({ width: '100%' });
const tag = xcss({ flexShrink: '0' });

function dueDate(reviewedAt, days) {
  const d = new Date(reviewedAt);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function askAgent(prompt) {
  rovo.open({ ...AGENT, prompt }).catch((err) => console.error('rovo.open failed', err));
}

function Empty() {
  return (
    <Stack space="space.150">
      <Heading as="h3">No committee verdict yet</Heading>
      <Text>
        Ask SF Market Research to stress-test this proposal, let the team object with page comments, then ask SF
        Devil's Advocate for a verdict. Once you save the review, the verdict shows up here.
      </Text>
      <Box>
        <Button appearance="primary" onClick={() => askAgent('Should we fund the initiative on this page?')}>
          Ask SF Devil's Advocate
        </Button>
      </Box>
    </Stack>
  );
}

function Verdict({ record, proposalTitle, siteUrl, onCheck, onCreateGates, checking, checkNote }) {
  const reviewed = (record.reviewedAt || '').slice(0, 10);
  return (
    <Stack space="space.250">
      <Stack space="space.050">
        <Inline space="space.100" alignBlock="center">
          <Lozenge appearance={VERDICT_LOOK[record.verdict] || 'default'} isBold>
            {record.verdict}
          </Lozenge>
          {record.score !== null && record.score !== undefined && <Heading as="h3">{record.score}/100</Heading>}
        </Inline>
        <Text>
          Committee verdict on {proposalTitle || 'this proposal'}, reviewed {reviewed}.
        </Text>
      </Stack>

      {record.newComments > 0 && (
        <SectionMessage appearance="warning" title={`${record.newComments} new comment${record.newComments > 1 ? 's' : ''} since this review`}>
          <Stack space="space.100">
            <Text>The team added objections after the verdict. Re-run the review so the committee answers them.</Text>
            <Box>
              <Button onClick={() => askAgent('Re-run the review: answer the new comments on this page.')}>
                Re-run the review
              </Button>
            </Box>
          </Stack>
        </SectionMessage>
      )}

      {record.axes?.length > 0 && (
        <Stack space="space.100">
          <Heading as="h4">Committee score</Heading>
          {record.axes.map((axis) => (
            <Stack key={axis.name} space="space.050">
              <Inline spread="space-between" xcss={row}>
                <Text>{axis.name}</Text>
                <Text>{axis.score}/25</Text>
              </Inline>
              <ProgressBar value={(axis.score || 0) / 25} ariaLabel={`${axis.name}: ${axis.score} of 25`} />
            </Stack>
          ))}
        </Stack>
      )}

      {record.objections?.length > 0 && (
        <Stack space="space.100">
          <Heading as="h4">Objections answered</Heading>
          {record.objections.map((o) => (
            <Inline key={o.summary} space="space.100" alignBlock="start">
              <Box xcss={tag}>
                <Lozenge appearance={RULING_LOOK[o.ruling] || 'default'}>{o.ruling}</Lozenge>
              </Box>
              <Text>{o.summary}</Text>
            </Inline>
          ))}
        </Stack>
      )}

      {record.gates?.length > 0 && (
        <Stack space="space.100">
          <Heading as="h4">Stage gates</Heading>
          {record.gates.map((g) => (
            <Inline key={`${g.days}-${g.criterion}`} space="space.100" alignBlock="start">
              <Box xcss={tag}>
                <Lozenge appearance={GATE_LOOK[g.state] || 'default'}>
                  {`Day ${g.days} · ${g.due || dueDate(record.reviewedAt, g.days)}${g.state === 'missed' ? ' · missed' : g.state === 'done' ? ' · met' : ''}`}
                </Lozenge>
              </Box>
              <Text>
                {g.key && siteUrl ? <Link href={`${siteUrl}/browse/${g.key}`}>{g.key}</Link> : null}
                {g.key ? ' ' : ''}
                {g.criterion}
              </Text>
            </Inline>
          ))}
          {record.gates.some((g) => g.key) ? (
            <Inline space="space.100" alignBlock="center">
              <Button appearance="subtle" onClick={onCheck} isDisabled={checking}>
                Check gates now
              </Button>
              {checkNote && <Text>{checkNote}</Text>}
            </Inline>
          ) : record.epic ? (
            <Inline space="space.100" alignBlock="center">
              <Button onClick={onCreateGates} isDisabled={checking}>
                Track gates in {record.epic.key}
              </Button>
              {checkNote && <Text>{checkNote}</Text>}
            </Inline>
          ) : (
            <Text>Create the Jira epic to track these gates: each one becomes a work item with a due date.</Text>
          )}
        </Stack>
      )}

      <Stack space="space.050">
        {record.review?.url && <Link href={record.review.url}>Read the full review</Link>}
        {record.epic?.url && <Link href={record.epic.url}>Open the Jira epic {record.epic.key}</Link>}
      </Stack>

      <Inline space="space.100">
        <Button onClick={() => askAgent('Re-run the review: there are new objections or new evidence.')}>
          Re-run the review
        </Button>
        {!record.epic && record.verdict !== 'STOP' && (
          <Button onClick={() => askAgent('Turn the plan into a Jira epic.')}>Create the Jira epic</Button>
        )}
      </Inline>
    </Stack>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState(null);

  const load = () =>
    invoke('getVerdict')
      .then(setData)
      .catch(() => setData({ record: null, error: 'The committee verdict could not be loaded.' }));

  useEffect(() => {
    load();
    view.getContext().then((c) => setSiteUrl(c?.siteUrl || '')).catch(() => {});
  }, []);

  const onCheck = async () => {
    setChecking(true);
    const result = await invoke('checkGatesNow').catch(() => ({ flagged: [], error: 'Check failed.' }));
    setCheckNote(
      result.error || (result.flagged.length ? `Flagged ${result.flagged.join(', ')} as missed.` : 'No new missed gates.')
    );
    await load();
    setChecking(false);
  };

  const onCreateGates = async () => {
    setChecking(true);
    const result = await invoke('createGates').catch(() => ({ error: 'Could not create the gates.' }));
    setCheckNote(result.error || `${result.created} gate work items created.`);
    await load();
    setChecking(false);
  };

  return (
    <Box xcss={panel}>
      {!data && <Spinner label="Loading the committee verdict" />}
      {data?.error && (
        <SectionMessage appearance="warning">
          <Text>{data.error}</Text>
        </SectionMessage>
      )}
      {data && !data.error && (data.record ? <Verdict {...data} siteUrl={siteUrl} onCheck={onCheck} onCreateGates={onCreateGates} checking={checking} checkNote={checkNote} /> : <Empty />)}
    </Box>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
