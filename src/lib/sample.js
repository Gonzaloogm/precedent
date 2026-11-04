// Fictional company history that "Load sample company" creates on a fresh site, so judges and new
// users can see the precedent check work without any data of their own. Everything here is
// invented; the company name and figures are made up.

export const SAMPLE_SPACE = {
  key: 'BRIGHTPATH',
  name: 'Brightpath Clinics (sample)',
  description: 'Fictional company created by SprintFounders to try the precedent check. Safe to delete.',
};

export const SAMPLE_LABEL = 'sprintfounders-sample';

// Pages are Markdown, converted with markdownToStorage. Order matters: history first, proposals last.
// Written over the space homepage. The marker phrase tells a later run it is already there.
export const SAMPLE_HOME_MARKER = 'fictional company';
export const SAMPLE_HOME = {
    markdown: `This space is a **fictional company** created by SprintFounders so you can try it without real data.

Brightpath Clinics runs 42 physiotherapy and dental clinics in Spain and Portugal, with about 600 staff. Every new initiative or budget request is written as a proposal page and reviewed before it gets money, people or time.

## Try it in three minutes
1. Open **Proposal: AI scheduling assistant for clinics**.
2. Open Rovo chat, pick **SF Market Research** and ask it to stress-test the proposal. It should find the cancelled SMS reminders pilot below.
3. Read the two objections the team left as comments, then ask **SF Devil's Advocate** whether to fund it.
4. If the verdict is GO or PIVOT, let it draft the Jira epic. The company's past initiatives are in Jira too, labelled "sprintfounders-sample".

## Company history in this space
- 2025 Retro: Patient SMS reminders pilot (cancelled)
- 2023 Retro: Online booking widget (shipped)
- 2024 Decision: Buy, don't build, the patient portal
- 2025 Q3 Marketing review: Instagram campaign for physio (stopped)
- 2024 Retro: Physio packages for gyms (paused)`,
};

export const SAMPLE_PAGES = [
  {
    title: '2025 Retro: Patient SMS reminders pilot (cancelled)',
    markdown: `**Status:** Cancelled in September 2025 after 4 months. **Owner:** Operations. **Spent:** EUR 82,000.

## What we tried
Automatic SMS reminders 48 h and 2 h before each appointment, with a reply-to-cancel option, in 6 pilot clinics. The goal was to cut the no-show rate from 14% to 8%.

## What happened
- Only **11% of patients opted in**. Consent had to be collected at the front desk under GDPR, and reception staff did not have time to ask every patient.
- The no-show rate stayed at **14%** in the pilot clinics, the same as in the control clinics.
- Messaging cost **EUR 2,100 per month** for 6 clinics, more than the revenue recovered.
- Cancellations by SMS arrived too late to refill the slot, because the front desk only checked the inbox twice a day.

## Lessons
1. Anything that adds work at the front desk fails. Reception is the bottleneck in every clinic.
2. Reminders alone do not fill empty slots. The real problem is **refilling cancelled appointments fast**.
3. Patient consent must be collected digitally, at booking time, not at the desk.
4. Measure against control clinics from day one.`,
  },
  {
    title: '2023 Retro: Online booking widget (shipped)',
    markdown: `**Status:** Shipped to all clinics in 2023. **Owner:** Digital. **Spent:** EUR 45,000.

## Result
- **38% of appointments** are now booked online, up from 0%.
- Phone calls to reception dropped by about a quarter.

## Why it worked
- Reception kept full control: they could block slots and move appointments in the same calendar they already used.
- We launched in 2 clinics, fixed the problems, then rolled out in 3 waves.
- Patients give SMS and email consent when they book online, so we now have consent for about 40% of active patients.`,
  },
  {
    title: "2024 Decision: Buy, don't build, the patient portal",
    markdown: `**Decision:** Buy an off-the-shelf patient portal instead of building our own. **Approved by:** Leadership team, March 2024.

## Context
Building a portal was estimated at EUR 300,000 and 12 months. Integration with our clinical records system (EHR) was the main risk.

## What we learned
- Even the bought portal took **9 months** to integrate with the EHR, three times the vendor estimate.
- Rule for future initiatives: **any integration with the EHR must be budgeted at 3x the vendor estimate**, and needs the EHR team in the plan from week one.`,
  },
  {
    title: '2025 Q3 Marketing review: Instagram campaign for physio (stopped)',
    markdown: `**Status:** Stopped after 8 weeks. **Owner:** Marketing. **Spent:** EUR 24,000.

## Result
- Cost per new patient was **EUR 140**, against a target of EUR 60.
- Most clicks came from people outside our clinics' cities.

## Lessons
- Paid social only works with tight local targeting around each clinic.
- Referrals from existing patients bring new patients at about EUR 35 each. Invest there first.`,
  },
  {
    title: '2024 Retro: Physio packages for gyms (paused)',
    markdown: `**Status:** Paused in November 2024. **Owner:** Sales. **Spent:** EUR 18,000.

## What we tried
Prepaid packages of 5 physio sessions sold through 3 partner gyms.

## What happened
- 160 packages sold, but only **35% of sessions were used**, which made the gyms unhappy with the deal.
- Our clinics near the gyms were already full in the evening, the only time gym members wanted to come.

## Lessons
- Check clinic capacity at the hours the new customers want before selling anything.
- B2B partners judge us on usage, not on sales.`,
  },
  {
    title: 'Proposal: AI scheduling assistant for clinics',
    proposal: true,
    markdown: `**Requested by:** Operations. **Budget asked:** EUR 60,000 for the first year. **Team:** 2 developers and 1 operations lead for 6 months.

## Problem
Our no-show rate is 14%. Every empty slot is lost revenue, and reception spends hours a day on the phone moving appointments.

## Proposed solution
An AI assistant that talks to patients by SMS and WhatsApp. It confirms appointments, reschedules them in conversation and offers freed-up slots to patients on a waiting list.

## Who it is for
Reception staff and patients in our 42 clinics. Later, we could sell it to other clinic networks.

## Success metrics
- No-show rate from 14% to 7% in 6 months.
- 20% less phone time at reception.

## Key assumptions
- Patients will accept talking to an AI assistant.
- Integration with our EHR calendar takes about 2 months.
- WhatsApp costs stay below EUR 0.05 per conversation.

## Risks
- Patient data protection (GDPR).
- Reception staff may not trust the assistant.`,
    comments: [
      'The front desk already rejected the SMS pilot because it added work for them. Why would an AI assistant be different? Who handles the conversations the assistant cannot solve?',
      'EUR 60,000 looks low. The 2024 portal decision says any EHR integration should be budgeted at 3x the vendor estimate. Has the EHR team seen this plan?',
    ],
  },
];

// Past initiatives in Jira, so the precedent check also finds work items. Each epic is moved to a
// done status after creation; its outcome is in the description.
export const SAMPLE_EPICS = [
  {
    summary: 'SMS reminders pilot (2025, cancelled)',
    description:
      'Outcome: cancelled after 4 months. Only 11% of patients opted in, the no-show rate stayed at 14% and messaging cost EUR 2,100 per month.\n\nSee the retro page "2025 Retro: Patient SMS reminders pilot (cancelled)" in Confluence.',
    stories: [
      'Integrate SMS gateway with EHR appointments',
      'Collect patient SMS consent at the front desk',
      'Reply-to-cancel inbox for reception',
    ],
  },
  {
    summary: 'Online booking widget (2023, shipped)',
    description:
      'Outcome: shipped to all clinics. 38% of appointments are now booked online. Reception kept control of the calendar.',
    stories: ['Booking widget for 2 pilot clinics', 'Roll-out in 3 waves'],
  },
  {
    summary: 'Instagram campaign for physio (2025 Q3, stopped)',
    description: 'Outcome: stopped after 8 weeks. Cost per new patient was EUR 140 against a EUR 60 target.',
    stories: ['Campaign creative and landing page'],
  },
];

export const SAMPLE_PROPOSAL_TITLE = SAMPLE_PAGES.find((p) => p.proposal).title;
export const SAMPLE_EPIC_COUNT = SAMPLE_EPICS.length;

/** Pages still to create, given the titles that already exist in the sample space. */
export function pagesToCreate(existingTitles) {
  const existing = new Set((existingTitles || []).map((t) => String(t).trim().toLowerCase()));
  return SAMPLE_PAGES.filter((p) => !existing.has(p.title.toLowerCase()));
}

/** A transition that ends in a "done" status category, whatever the workflow calls it. */
export function pickDoneTransition(transitions) {
  return (transitions || []).find((t) => t?.to?.statusCategory?.key === 'done') || null;
}
