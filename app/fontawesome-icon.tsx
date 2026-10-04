import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export default function AppIcon({ icon, className = "" }: { icon: IconDefinition; className?: string }) {
  return <FontAwesomeIcon icon={icon} className={className} aria-hidden="true" />;
}
