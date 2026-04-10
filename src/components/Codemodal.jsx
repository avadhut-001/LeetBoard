import React from "react";

const CodeModal = ({
  ui,
  timeComplexity,
  setTimeComplexity,
  codeValue,
  setCodeValue,
  selectedCodeIdx,
  setSelectedCodeIdx,
  codes,
  setCodes,
  setShowCodeModal,
}) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className={`w-[500px] max-w-[90%] ${ui.bg} border ${ui.border} rounded-xl shadow-xl p-5`}>

        <h2 className="text-lg font-semibold mb-4">Add Solution Code</h2>

        {/* Time Complexity */}
        <div className="mb-3">
          <label className="text-sm mb-1 block">Time Complexity</label>
          <input
            type="text"
            placeholder="e.g. O(n log n)"
            value={timeComplexity}
            onChange={(e) => setTimeComplexity(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border ${ui.border} ${ui.bg} ${ui.text}`}
          />
        </div>

        {/* Code */}
        <div className="mb-4">
          <label className="text-sm mb-1 block">Code</label>
          <textarea
            placeholder="// Write your solution here..."
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            className={`w-full h-40 px-3 py-2 rounded-md border ${ui.border} ${ui.bg} ${ui.text} font-mono text-sm`}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCodeModal(false)}
            className="px-3 py-1.5 text-sm rounded-md border"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (!timeComplexity && !codeValue) return;

              if (selectedCodeIdx !== -1) {
                const updated = [...codes];
                updated[selectedCodeIdx] = { time: timeComplexity, code: codeValue };
                setCodes(updated);
              } else {
                setCodes(prev => [...prev, { time: timeComplexity, code: codeValue }]);
              }

              setSelectedCodeIdx(-1);
              setTimeComplexity("");
              setCodeValue("");
              setShowCodeModal(false);
            }}
            className="px-3 py-1.5 text-sm rounded-md bg-violet-500 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeModal;