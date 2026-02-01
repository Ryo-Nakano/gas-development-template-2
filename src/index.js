import { SampleOperation } from '@/operations/sample_operation.js';

global.sampleOperation = () => {
  const operation = new SampleOperation();
  operation.run();
};
