import { Icon } from "@/components/brand/icon";
import { predictionStates, type PredictionState } from "./prediction-text";

export function PredictionBadge({ state }: { state: PredictionState }) {
  const { label, icon, badge } = predictionStates[state];
  return (
    <span className={`oc-badge ${badge}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}
