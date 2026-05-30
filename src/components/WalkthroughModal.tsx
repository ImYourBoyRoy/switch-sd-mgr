import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2 } from "lucide-react";
import type { ActiveTab } from "../app-types";

interface WalkthroughStep {
  title: string;
  description: string;
  tab: ActiveTab;
}

interface WalkthroughModalProps {
  open: boolean;
  walkthroughStep: number;
  walkthroughSteps: readonly WalkthroughStep[];
  setWalkthroughStep: Dispatch<SetStateAction<number>>;
  completeWalkthrough: () => void;
  jumpToTab: (tab: ActiveTab) => void;
}

export function WalkthroughModal({
  open,
  walkthroughStep,
  walkthroughSteps,
  setWalkthroughStep,
  completeWalkthrough,
  jumpToTab,
}: WalkthroughModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal elevated-card walkthrough-modal">
        <div className="panel-header">
          <div>
            <h2>Quick setup walkthrough</h2>
            <small>
              Step {walkthroughStep + 1} of {walkthroughSteps.length}
            </small>
          </div>
          <button className="btn-ghost" onClick={completeWalkthrough}>
            Finish
          </button>
        </div>
        <div className="walkthrough-step">
          <span className="eyebrow">
            <CheckCircle2 size={15} />
            {walkthroughSteps[walkthroughStep].title}
          </span>
          <p>{walkthroughSteps[walkthroughStep].description}</p>
        </div>
        <div className="walkthrough-dots" aria-hidden="true">
          {walkthroughSteps.map((step, index) => (
            <span key={step.title} className={index === walkthroughStep ? "active" : ""} />
          ))}
        </div>
        <div className="button-row compact-row end-row">
          <button
            className="btn-secondary"
            disabled={walkthroughStep === 0}
            onClick={() => setWalkthroughStep((step) => Math.max(step - 1, 0))}
          >
            Back
          </button>
          <button className="btn-secondary" onClick={() => jumpToTab(walkthroughSteps[walkthroughStep].tab)}>
            Jump to section
          </button>
          {walkthroughStep === walkthroughSteps.length - 1 ? (
            <button className="btn-primary" onClick={completeWalkthrough}>
              Done
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setWalkthroughStep((step) => step + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
