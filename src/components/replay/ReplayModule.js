import { jsx as _jsx } from "react/jsx-runtime";
import ReplayMotionPlayer from "./ReplayMotionPlayer";
import "./replay.css";
export default function ReplayModule({ grid, endSec, bases, teamOfRaw, loadUnitTracks, winnerTeam, melee, soleView, active = true, sceneLink, clockKey, onFinish, onDetailClose, shareNode, onShare, shareLabel, onGuide, guide, side, menu, avatars, askMode, pending, }) {
    return (_jsx("div", { className: "scr-story-map", children: _jsx(ReplayMotionPlayer, { grid: grid, endSec: endSec, bases: bases, teamOfRaw: teamOfRaw, active: active, sceneLink: sceneLink, clockKey: clockKey, shareNode: shareNode, onShare: onShare, shareLabel: shareLabel, onGuide: onGuide, guide: guide, onDetailClose: onDetailClose, soleView: soleView, loadUnitTracks: loadUnitTracks, winnerTeam: winnerTeam, melee: melee, onFinish: onFinish, side: side, menu: menu, avatars: avatars, askMode: askMode, pending: pending }) }));
}
