import React from 'react';
import cx from 'classnames';
import styles from "./TextInput.module.css";

interface InputProps {
  className?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onFocusCapture?: React.FocusEventHandler<HTMLInputElement>;
  onBlurCapture?: React.FocusEventHandler<HTMLInputElement>;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  ref?: any;
  value: string;
}

const TextInput: React.FC<InputProps> = ({ className, placeholder, onChange, disabled, ref, onFocus, onFocusCapture, onBlurCapture, value }) => {
  return (
    <input type="text" ref={ref} value={value} onChange={onChange} onFocus={onFocus} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}
      className={cx(styles.textInput, className)} placeholder={placeholder} disabled={disabled} />
  );
};

export default TextInput;

