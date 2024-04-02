
const Spinner = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4"></circle>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 1 8.17 15.57l1.42-1.42A12 12 0 0 0 12 0v2c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8a1 1 0 0 1 2 0c0 3.31 2.69 6 6 6s6-2.69 6-6-2.69-6-6-6z"
      ></path>
    </svg>
  );
};

export default Spinner;
