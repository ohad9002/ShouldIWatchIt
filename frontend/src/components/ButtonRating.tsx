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
          className={`px-3 py-1 rounded transition-all duration-200 ${
            num === value ? "button-rating-selected" : "button-rating"
          }`}
        >
          {num}
        </button>
      ))}
    </div>
  );
};

export default ButtonRating;
