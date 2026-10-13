#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {launch} from './base-onboarding/launcher.mjs';
import {createSeed} from './installer/seed.mjs';
await launch(fileURLToPath(new URL('..',import.meta.url)),createSeed());
