import "./PopcornLoader.css";

const PopcornLoader = () => {
  return (
    <div className="popcorn-loader">
      {/* Static popcorns */}
      <div className="static-popcorns">
        {/* First row (shortest) */}
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`row1-${index}`} className="static-kernel"></div>
        ))}

        {/* Second row */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`row2-${index}`} className="static-kernel"></div>
        ))}

        {/* Third row */}
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={`row3-${index}`} className="static-kernel"></div>
        ))}

        {/* Fourth row (longest) */}
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={`row4-${index}`} className="static-kernel"></div>
        ))}
      </div>

      {/* Popcorn bucket */}
      <div className="bucket">
        <div className="stripes"></div>
      </div>

      {/* Animated popcorn kernels */}
      <div className="kernel kernel1"></div>
      <div className="kernel kernel2"></div>
      <div className="kernel kernel3"></div>
    </div>
  );
};

export default PopcornLoader;
