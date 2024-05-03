import React, { DetailedHTMLProps, InputHTMLAttributes } from 'react';
import styles from "./NumberInput.module.css";
import { cx } from '@/popup/utils';

const NumberInput: React.FC<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>> = (props) => {
  return (
    <input type="number" {...props} className={cx(styles.numberInput, props.className)} />
  );
};

export default NumberInput;

