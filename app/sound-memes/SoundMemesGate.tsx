"use client";

import { useChainMode } from "../contexts/NetworkContext";
import SoundMemesClient from "./SoundMemesClient";
import RobinhoodPoolsClient from "./RobinhoodPoolsClient";

export default function SoundMemesGate() {
  const { isRobinhood } = useChainMode();
  return isRobinhood ? <RobinhoodPoolsClient /> : <SoundMemesClient />;
}
