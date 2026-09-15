"use client";

import { useChainMode } from "../../contexts/NetworkContext";
import SoundMemeDetailPage from "./SoundMemeDetailPage";
import RobinhoodDetailPage from "../RobinhoodDetailPage";

export default function DetailGate() {
  const { isRobinhood } = useChainMode();
  return isRobinhood ? <RobinhoodDetailPage /> : <SoundMemeDetailPage />;
}
