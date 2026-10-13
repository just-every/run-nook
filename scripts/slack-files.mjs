#!/usr/bin/env node
import { runSlackFiles } from './slack-files/command.mjs';
process.exitCode = await runSlackFiles(process.argv.slice(2));
