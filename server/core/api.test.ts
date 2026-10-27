import { describeContract } from './contract.suite';
import { MemoryServerDb } from './db';

describeContract('memory', () => new MemoryServerDb());
