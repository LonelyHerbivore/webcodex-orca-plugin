#!/usr/bin/env node
import { serve } from './protocol.mjs';
import { tools } from './tools.mjs';
serve(tools);
