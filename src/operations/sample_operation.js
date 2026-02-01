import { BaseOperation } from "@/base_classes/base_operation";
import { SAMPLE } from '@/constants.js';

export class SampleOperation extends BaseOperation {
  _operation() {
    console.log(SAMPLE.MESSAGE);
  }
}
