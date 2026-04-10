import React from "react";

const ToolButton = ({ icon, active = false, onClick, ui }) => (
  <button
    onClick={onClick}
    className={`p-2.5 rounded-lg transition-colors ${
      active ? ui.activeBg : `${ui.hover} ${ui.text}`
    }`}
  >
    {icon}
  </button>
);

export const LabelButton = ({ icon, label, onClick, ui, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center gap-2 px-3 py-2 ${ui.bg} border ${ui.border} rounded-lg shadow-sm ${ui.hover} ${ui.text} transition-colors text-sm font-medium`}
  >
    {icon}
    {label}
  </button>
);

export default ToolButton;