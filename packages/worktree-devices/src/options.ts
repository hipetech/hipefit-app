import type { CliOptions, Command } from './types';

export const HELP = `Usage:
  bun run packages/worktree-devices/src/cli.ts run [--dry-run] [--template <UDID>]
  bun run packages/worktree-devices/src/cli.ts detach [--dry-run] [--force]
  bun run packages/worktree-devices/src/cli.ts list
  bun run packages/worktree-devices/src/cli.ts show [name]
  bun run packages/worktree-devices/src/cli.ts hide [name] [--all]
  bun run packages/worktree-devices/src/cli.ts stop [name]
  bun run packages/worktree-devices/src/cli.ts remove [name] [--all] [--force] [--yes]
  bun run packages/worktree-devices/src/cli.ts --help

Commands:
  run       Reuse or allocate a managed simulator and Metro port, then run Expo.
  detach    Shut down and release this worktree's managed simulator. Refuses
            while this worktree's runner is active or its Metro port answers.
  list      Show every worktree assignment with its Metro port and runner, the
            free pool, and stale entries.
  show      Open a managed simulator in a window.
  hide      Shut down one managed simulator so its window goes away.
  stop      Stop the Metro server a worktree reserved, leaving its simulator
            running. Signals only a listener it recognizes as that worktree's
            Expo dev server.
  remove    Delete a managed simulator for good. Offers the free pool, asks
            before deleting, and refuses assigned simulators without --force.

Targets:
  [name] is a managed simulator's name, its UDID, or the Metro port assigned
  to it. show, hide, stop, and remove without one take the simulator this
  worktree holds, when it is among the ones the command offers. In a terminal
  with several on offer they list them first, and Enter takes this worktree's.

  When this worktree holds none of them there is no default. In a terminal the
  command lists them, even a single one, and needs a number: Enter selects
  nothing and the command stops. Without a terminal it stops and asks for a
  target. remove offers the free pool, which never holds this worktree's
  simulator, so a scripted remove without --force needs a target or --all.

Options:
  --dry-run                 Show the selected resources without changing anything.
  --all                     With hide, close Simulator so every window goes
                            while the simulators keep running. With remove,
                            delete every free managed simulator.
  --yes                     Skip the confirmation that remove asks for. It
                            does not choose the target.
  --force                   Detach even while this worktree's runner is active
                            or its Metro port is in use. With remove,
                            include assigned simulators. It does
                            not choose the target either.
  --template <UDID>         Use this iPhone simulator as the creation template.
  --template-udid <UDID>    Alias for --template.
  -h, --help                Show this help.

Ports, scheme, bundle identifier, and app directory come from worktree-devices.json\nin the repository root. Managed ports default to 18081-18180.
`;

export const parseOptions = (args: string[]): CliOptions => {
  let command: Command | undefined;
  let dryRun = false;
  let force = false;
  let help = false;
  let templateUdid: string | undefined;
  let target: string | undefined;
  let all = false;
  let confirmed = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (
      argument === 'run' ||
      argument === 'detach' ||
      argument === 'list' ||
      argument === 'show' ||
      argument === 'hide' ||
      argument === 'stop' ||
      argument === 'remove'
    ) {
      if (command) throw new Error('Pass exactly one subcommand.');
      command = argument;
      continue;
    }
    if (argument === '--dry-run') {
      if (dryRun) throw new Error('Pass --dry-run at most once.');
      dryRun = true;
      continue;
    }
    if (argument === '--yes' || argument === '-y') {
      confirmed = true;
      continue;
    }
    if (argument === '--all') {
      if (all) throw new Error('Pass --all at most once.');
      all = true;
      continue;
    }
    if (argument === '--force') {
      if (force) throw new Error('Pass --force at most once.');
      force = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      help = true;
      continue;
    }
    if (argument === '--template' || argument === '--template-udid') {
      if (templateUdid)
        throw new Error('Pass a template simulator at most once.');
      const value = args[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`${argument} requires a simulator UDID.`);
      }
      templateUdid = value;
      index += 1;
      continue;
    }
    if (
      (command === 'show' ||
        command === 'hide' ||
        command === 'stop' ||
        command === 'remove') &&
      !argument?.startsWith('-') &&
      !target
    ) {
      target = argument;
      continue;
    }
    const templateAssignment = argument?.match(
      /^--(?:template|template-udid)=(.+)$/
    );
    if (templateAssignment) {
      if (templateUdid)
        throw new Error('Pass a template simulator at most once.');
      templateUdid = templateAssignment[1];
      continue;
    }
    throw new Error(`Unknown argument: ${argument ?? ''}`);
  }

  if (!help && !command) {
    throw new Error(
      'Missing subcommand: run, detach, list, show, hide, or stop.'
    );
  }
  if (
    (command === 'list' ||
      command === 'show' ||
      command === 'hide' ||
      command === 'stop' ||
      command === 'remove') &&
    (dryRun || templateUdid)
  ) {
    throw new Error(`${command} takes no options.`);
  }
  if (all && command !== 'hide' && command !== 'remove') {
    throw new Error(
      '--all can only be used with the hide or remove subcommand.'
    );
  }
  if (confirmed && command !== 'remove') {
    throw new Error('--yes can only be used with the remove subcommand.');
  }
  if (all && target) {
    throw new Error('Pass either --all or one simulator name, not both.');
  }
  if (command === 'detach' && templateUdid) {
    throw new Error('--template can only be used with the run subcommand.');
  }
  if (force && command !== 'detach' && command !== 'remove') {
    throw new Error(
      '--force can only be used with the detach or remove subcommand.'
    );
  }
  return { command, dryRun, force, help, templateUdid, target, all, confirmed };
};
