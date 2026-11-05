import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  DynamicTable,
  Heading,
  Inline,
  Link,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const LIGHT = {
  red: { appearance: 'removed', label: 'At risk' },
  amber: { appearance: 'moved', label: 'Needs attention' },
  green: { appearance: 'success', label: 'On track' },
};
const VERDICT_LOOK = { GO: 'success', PIVOT: 'moved', STOP: 'removed' };
const tile = xcss({
  padding: 'space.200',
  borderRadius: 'border.radius',
  backgroundColor: 'elevation.surface.sunken',
  minWidth: '160px',
});

function Tile({ light, count }) {
  return (
    <Box xcss={tile}>
      <Stack space="space.050">
        <Heading as="h2">{count}</Heading>
        <Box>
          <Lozenge appearance={LIGHT[light].appearance} isBold>
            {LIGHT[light].label}
          </Lozenge>
        </Box>
      </Stack>
    </Box>
  );
}

const head = {
  cells: [
    { key: 'light', content: 'Status' },
    { key: 'proposal', content: 'Proposal' },
    { key: 'verdict', content: 'Verdict' },
    { key: 'gates', content: 'Stage gates' },
    { key: 'next', content: 'Next gate' },
    { key: 'epic', content: 'Jira' },
  ],
};

function toRow(r, siteUrl) {
  return {
    key: r.id,
    cells: [
      {
        key: 'light',
        content: (
          <Stack space="space.050">
            <Box>
              <Lozenge appearance={LIGHT[r.light].appearance} isBold>
                {LIGHT[r.light].label}
              </Lozenge>
            </Box>
            <Text size="small">{r.reason}</Text>
          </Stack>
        ),
      },
      {
        key: 'proposal',
        content: (
          <Stack space="space.050">
            <Link href={r.url}>{r.title}</Link>
            <Text size="small">Reviewed {r.reviewedAt}</Text>
          </Stack>
        ),
      },
      {
        key: 'verdict',
        content: (
          <Inline space="space.100" alignBlock="center">
            <Lozenge appearance={VERDICT_LOOK[r.verdict] || 'default'}>{r.verdict}</Lozenge>
            {r.score !== null && <Text>{r.score}/100</Text>}
          </Inline>
        ),
      },
      {
        key: 'gates',
        content: r.gates.total ? (
          <Text>
            {r.gates.done}/{r.gates.total} met{r.gates.missed ? `, ${r.gates.missed} missed` : ''}
          </Text>
        ) : (
          <Text>None</Text>
        ),
      },
      {
        key: 'next',
        content: r.next ? (
          <Stack space="space.050">
            <Text>{r.next.due}</Text>
            <Text size="small">{r.next.criterion}</Text>
          </Stack>
        ) : (
          <Text>-</Text>
        ),
      },
      {
        key: 'epic',
        content:
          r.epic?.key && siteUrl ? (
            <Link href={r.epic.url || `${siteUrl}/browse/${r.epic.key}`}>{r.epic.key}</Link>
          ) : (
            <Text>-</Text>
          ),
      },
    ],
  };
}

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    invoke('getPortfolio')
      .then(setData)
      .catch(() => setData({ rows: [], error: 'The portfolio could not be loaded. Reload the page to try again.' }));
  }, []);

  if (!data) return <Spinner label="Loading the portfolio" />;

  return (
    <Stack space="space.300">
      <Stack space="space.100">
        <Heading as="h2">Committee portfolio</Heading>
        <Text>
          Every proposal the committee has reviewed, worst first. A missed stage gate or a STOP turns it red: stop
          spending until the committee looks again.
        </Text>
      </Stack>

      {data.error && (
        <SectionMessage appearance="error">
          <Text>{data.error}</Text>
        </SectionMessage>
      )}

      {!data.error && !data.rows.length && (
        <SectionMessage appearance="information" title="No reviewed proposals yet">
          <Text>
            Ask Precedent Devil's Advocate to review a proposal and save the review. It will appear here with its stage
            gates.
          </Text>
        </SectionMessage>
      )}

      {data.rows.length > 0 && (
        <>
          <Inline space="space.200" shouldWrap>
            <Tile light="red" count={data.totals.red} />
            <Tile light="amber" count={data.totals.amber} />
            <Tile light="green" count={data.totals.green} />
          </Inline>
          <DynamicTable head={head} rows={data.rows.map((r) => toRow(r, data.siteUrl))} />
        </>
      )}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
