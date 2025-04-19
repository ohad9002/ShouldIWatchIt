import React from "react";

type ButtonRatingProps = {
  value: number;
  onChange: (value: number) => void;
};

const ButtonRating: React.FC<ButtonRatingProps> = ({ value, onChange }) => {
  return (
    <div className="flex space-x-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
        <button
          key={num}
          onClick={() => onChange(num)}
          className={`px-3 py-1 rounded ${
            num === value ? "bg-red-500 text-white" : "bg-gray-800 text-gray-400"
          } hover:bg-red-700`}
        >
          {num}
        </button>
      ))}
    </div>
  );
};

export default ButtonRating;