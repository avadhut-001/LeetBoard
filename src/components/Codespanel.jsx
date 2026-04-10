import React from "react";

const CodesPanel = ({
  ui,
  codes,
  setCodes,
  setSelectedCodeIdx,
  setTimeComplexity,
  setCodeValue,
  setShowCodeModal,
}) => {
  return (
    <div className={`absolute top-16 right-4 w-64 max-h-[300px] overflow-y-auto ${ui.bg} border ${ui.border} rounded-xl shadow-lg p-3 z-40`}>
      <p className={`text-xs font-semibold ${ui.subText} mb-2 uppercase tracking-wider`}>
        Saved Codes
      </p>

      {codes.length === 0 && (
        <p className="text-xs text-gray-400">No code saved</p>
      )}

      {codes.map((c, idx) => (
        <div
          key={idx}
          className={`flex items-center justify-between px-2 py-2 rounded-md mb-1 cursor-pointer ${ui.hover}`}
          onClick={() => {
            setSelectedCodeIdx(idx);
            setTimeComplexity(c.time);
            setCodeValue(c.code);
            setShowCodeModal(true);
          }}
        >
          <span className="text-sm truncate">
            {c.time || "No complexity"}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setCodes(prev => prev.filter((_, i) => i !== idx));
            }}
            className="text-red-400 text-xs px-2"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default CodesPanel;