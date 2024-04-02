import React from 'react';
import cx from 'classnames';
import styles from "./NumberInput.module.css";

interface InputProps {
  className?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  value: number | null;
}

const NumberInput: React.FC<InputProps> = ({ className, placeholder, onChange, min, max, disabled, value }) => {
  return (
    <input type="number" onChange={onChange} className={cx(styles.numberInput, className)} min={min} max={max} placeholder={placeholder} disabled={disabled} value={value || ''} />
  );
};

export default NumberInput;

