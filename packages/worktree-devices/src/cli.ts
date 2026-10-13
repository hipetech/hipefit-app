import { detach } from './commands/detach';
import { hide } from './commands/hide';
import { list } from './commands/list';
import { remove } from './commands/remove';
import { run } from './commands/run';
import { show } from './commands/show';
import { stop } from './commands/stop';
import { getGitContext } from './core/context';
import { errorMessage } from './lib/command';
import { HELP, parseOptions } from './options';

const main = async (): Promise<number | NodeJS.Signals> => {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  const context = await getGitContext();
  if (options.command === 'detach') {
    await detach(context, options);
    return 0;
  }
  if (options.command === 'list') {
    await list(context);
    return 0;
  }
  if (options.command === 'show') {
    await show(context, options.target);
    return 0;
  }
  if (options.command === 'hide') {
    await hide(context, options.target, options.all);
    return 0;
  }
  if (options.command === 'stop') {
    await stop(context, options.target);
    return 0;
  }
  if (options.command === 'remove') {
    await remove(context, options);
    return 0;
  }
  if (options.command === 'run') return run(context, options);
  throw new Error(
    'Missing subcommand: run, detach, list, show, hide, or stop.'
  );
};

main()
  .then((result) => {
    if (typeof result === 'number') {
      process.exitCode = result;
      return;
    }
    process.kill(process.pid, result);
  })
  .catch((error: unknown) => {
    console.error(`iOS worktree command failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
