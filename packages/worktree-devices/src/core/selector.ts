import { createInterface } from 'node:readline/promises';
import type {
  GitContext,
  RegistryState,
  SimulatorChoice,
  SimulatorInventory,
} from '../types';

import { existingDeviceMap } from './inventory';

export const buildChoices = (
  state: RegistryState,
  inventory: SimulatorInventory
): SimulatorChoice[] => {
  const devices = existingDeviceMap(inventory);
  const assignments = new Map(
    state.assignments.map((assignment) => [
      assignment.simulatorUdid,
      assignment,
    ])
  );
  return state.simulators.map((simulator) => ({
    simulator,
    device: devices.get(simulator.udid),
    worktree: assignments.get(simulator.udid)?.worktree,
    port: assignments.get(simulator.udid)?.port,
  }));
};

export const describeChoice = (
  choice: SimulatorChoice,
  here: string
): string => {
  const state = choice.device?.state ?? 'missing';
  const owner =
    choice.worktree === here
      ? 'this worktree'
      : (choice.worktree ?? 'free pool');
  const metro =
    choice.port === undefined
      ? ''
      : `, port ${choice.port}${
          choice.serving === undefined
            ? ''
            : choice.serving
              ? ' serving'
              : ' idle'
        }`;
  return `${choice.simulator.name} (${choice.simulator.udid}) ${state}${metro}, ${owner}`;
};

const matchChoice = (
  choices: SimulatorChoice[],
  target: string
): SimulatorChoice | undefined => {
  const wanted = target.trim().toLowerCase();
  return choices.find(
    ({ simulator, port }) =>
      simulator.name.toLowerCase() === wanted ||
      simulator.udid.toLowerCase() === wanted ||
      (port !== undefined && String(port) === wanted)
  );
};

const targetForms = (choices: SimulatorChoice[]): string =>
  choices.some(({ port }) => port !== undefined)
    ? 'a simulator name, a UDID, or an assigned Metro port'
    : 'a simulator name or a UDID';

// The only default is the simulator this worktree holds. Without one the list
// has no marked row and no default number, so Enter selects nothing. The
// question is asked once: a bad answer fails the command instead of looping.
const askForChoice = async (
  choices: SimulatorChoice[],
  here: string,
  defaultIndex?: number
): Promise<SimulatorChoice> => {
  console.log('Managed simulators:');
  choices.forEach((choice, index) => {
    const marker = index === defaultIndex ? '*' : ' ';
    console.log(`${marker} ${index + 1}) ${describeChoice(choice, here)}`);
  });
  const range = `[1-${choices.length}]`;
  const prompt =
    defaultIndex === undefined
      ? `Select a simulator ${range}: `
      : `Select a simulator ${range} (${defaultIndex + 1}): `;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(prompt)).trim();
    if (!answer) {
      const fallback =
        defaultIndex === undefined ? undefined : choices[defaultIndex];
      if (fallback) return fallback;
      throw new Error(
        `No simulator was selected, and none of these belongs to this worktree. Enter a number between 1 and ${choices.length}, or pass ${targetForms(choices)}.`
      );
    }
    const picked = Number.parseInt(answer, 10);
    if (!Number.isInteger(picked) || picked < 1 || picked > choices.length) {
      throw new Error(`Choose a number between 1 and ${choices.length}.`);
    }
    return choices[picked - 1] as SimulatorChoice;
  } finally {
    rl.close();
  }
};

// An omitted target only ever resolves to this worktree's own simulator.
// Falling back to the first candidate would act on another worktree's
// simulator or on a free one, so a caller whose candidates hold nothing of
// this worktree's gets a question in a terminal and an error without one, even
// when there is a single candidate. Reading an answer needs a terminal, which
// is why a piped or scripted call has to name its target in that case.
export const resolveChoice = async (
  context: GitContext,
  choices: SimulatorChoice[],
  target?: string,
  emptyMessage = 'No managed simulator exists yet. Run "bun run ios:worktree" first.'
): Promise<SimulatorChoice> => {
  if (choices.length === 0) throw new Error(emptyMessage);
  const names = choices
    .map(({ simulator }) => `"${simulator.name}"`)
    .join(', ');
  if (target) {
    const matched = matchChoice(choices, target);
    if (matched) return matched;
    throw new Error(`No managed simulator named "${target}". Known: ${names}.`);
  }
  const interactive = process.stdin.isTTY === true;
  const ownIndex = choices.findIndex(
    ({ worktree }) => worktree === context.worktree
  );
  const own = ownIndex >= 0 ? choices[ownIndex] : undefined;
  if (!own) {
    if (interactive) return askForChoice(choices, context.worktree);
    throw new Error(
      `None of these simulators belongs to this worktree, so there is no default: ${names}. Pass ${targetForms(choices)}.`
    );
  }
  if (choices.length === 1) return own;
  if (!interactive) {
    console.log(
      `Defaulting to ${own.simulator.name}. Pass a name to choose another.`
    );
    return own;
  }
  return askForChoice(choices, context.worktree, ownIndex);
};

export const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N]: `)).trim();
    return /^y(es)?$/i.test(answer);
  } finally {
    rl.close();
  }
};
