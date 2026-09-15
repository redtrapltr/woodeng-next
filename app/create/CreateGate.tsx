"use client";

import { useChainMode } from "../contexts/NetworkContext";
import RobinhoodCreateForm from "./RobinhoodCreateForm";
import MemeLockerClient from "../meme-locker/MemeLockerClient";

// Shared by /create and /meme-locker so both routes always show the form for
// whichever chain is currently active. Renders directly instead of
// router.replace-ing between the two routes — a navigation round trip was
// racy and could leave the wrong chain's form on screen after toggling back.
// The key prop forces a full remount on switch so neither form's state leaks
// into the other.
export default function CreateGate() {
  const { isRobinhood } = useChainMode();
  return isRobinhood ? <RobinhoodCreateForm key="rh" /> : <MemeLockerClient key="sol" />;
}
