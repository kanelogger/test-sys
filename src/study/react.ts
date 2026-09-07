import {
  createStudyWorkflow,
  type InitializeOutcome,
  type Result,
  type StudyWorkflow,
} from "./index";

/** 应用级唯一 workflow 实例（默认时钟、默认库名、随包种子） */
export const studyWorkflow: StudyWorkflow = createStudyWorkflow();

let initPromise: Promise<Result<InitializeOutcome>> | null = null;

/** 首开自动初始化且仅执行一次；失败不记忆，允许重试 */
export function initializeOnce(): Promise<Result<InitializeOutcome>> {
  initPromise ??= studyWorkflow.initialize().then((result) => {
    if (!result.ok) {
      initPromise = null;
    }
    return result;
  });
  return initPromise;
}
