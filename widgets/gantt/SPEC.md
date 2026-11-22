---
slug: gantt
title: Gantt chart
category: planning
status: beta
access: full
bundle-kb: 170
---

# Gantt chart

## Job

People who plan work in Grist (projects, interventions, a production
schedule, room bookings) see their tasks as bars on a timeline, in
groups, with the tasks that share a resource on one row. They move a bar
to change its dates, or drag its ends to change its length, and Grist
saves the new dates. The timeline shows days, weeks or months; the
widget's configuration sets the scale it opens on.

Grist has no timeline view; its forum threads asking for one count
thousands of views.

## Implementation

The reference widget's Gantt brought into the catalog, on the same
component: kibo-ui's Gantt (shadcn registry `@kibo-ui`, MIT), in
`widgets/_shared/kibo-ui/gantt/`.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Title | Text | yes | the task's name, on its bar |
| Start | Date | yes | the first day of the task |
| End | Date | yes | its last day |
| Group | Text, Choice or Ref | no | a section of the sidebar; a Choice column gives the group its colour |
| Sequence | Text, Choice or Ref | no | tasks with the same value share a timeline row (a person, a machine, a room); without it, each task has its row |
| Status | Choice | no | the bar's colour, from the choice's colour in Grist |

A row without a start or an end date is not shown; the header says how
many.

## Access

`full`: moving a bar writes the row's dates, and the Choice colours are
read from the columns' settings, which only full access reads.

## Acceptance criteria

- **AC-1** Given rows with dates, each is a bar with its title, in the
  sidebar under its group, on its sequence's row.
- **AC-2** Given no Sequence column, each task has a row of its own.
- **AC-3** Given rows of the same sequence, they share one row; overlapping
  ones stack.
- **AC-4** Given a Status Choice with colours in Grist, each bar takes its
  status's colour, with a text colour that reads on it; without one, bars
  take the theme's colours.
- **AC-5** Given a bar moved or resized, its row's Start and End are written
  as the days it now covers.
- **AC-6** Given rows without a start or an end date, they are left out and
  the header says how many.
- **AC-7** Given the scale buttons, the timeline shows days, weeks or months.
- **AC-8** Given a write that Grist refuses, the widget shows the error.
- **AC-9** Given a browser that prefers French, the widget's text and the
  timeline's dates are in French.
- **AC-10** Given a title that is HTML, it is shown as text.
- **AC-11** Given no task with dates, the widget says so.
- **AC-12** Given more than 50 tasks, the chart shows the first 50 in the
  section's order, with a button that shows the next ones.
- **AC-13** Given a default scale in the widget's configuration, the chart
  opens on it (weeks when none is set). Grist's "Open configuration" and the
  widget's settings icon open the same configuration view; a choice there
  applies at once, to the widget's options. Grist keeps them as a draft of
  the section until its own Save: a warning in the view says to click it,
  until Grist's Revert or the view closes. Its close button and Escape
  close the view. The scale buttons change the view only. On a
  document open read-only, the settings icon isn't shown.

## Standard criteria

The same in every catalog widget ([ADR 0018](../../docs/decisions/0018-standard-criteria.md)).

- **AC-volume** Given 5,000 rows, the widget renders them with at most 3,000 DOM nodes.
- **AC-keyboard** Tab reaches the widget's controls without getting stuck, and the page passes axe after it.
- **AC-narrow** The widget fits a 320 px side panel and a 1,280 px page, without scrolling sideways.
- **AC-readonly** On a document open read-only, the widget shows its data, and if it writes, it says why it can't.

## Out of scope

Planned for a later version, with the roadmap's modes:
- dependencies between tasks, and milestones;
- the resources mode (a row per person, with their load).

Not planned:
- creating tasks from the timeline: Grist's own table or the Record editor
  adds rows.

## Demo data

A renovation project: about twenty tasks in four groups (Design, Permits,
Works, Handover), on five teams as sequences, with a Status choice
(Planned, In progress, Done, Late) coloured in Grist.
