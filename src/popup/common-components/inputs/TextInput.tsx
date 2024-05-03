import React, { DetailedHTMLProps, InputHTMLAttributes } from 'react';
import styles from "./TextInput.module.css";
import { cx } from '@/popup/utils';

interface InputProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
  value: string;
}

const TextInput: React.FC<InputProps> = (props) => {
  return (
    <input type="text" {...props} className={cx(styles.textInput, props.className)} />
  );
};

export default TextInput;

