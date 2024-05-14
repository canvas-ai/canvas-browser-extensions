import React, { useEffect, useRef, useState } from 'react';
import styles from "./SearchableSelectBox.module.scss";
import { cx } from '@/popup/utils';

interface ISelectOption {
  label: string;
  value: string;
}

interface ISelectBoxProps {
  defaultValue?: ISelectOption;
  placeholder?: string;
  onChange?: (item: ISelectOption) => void;
  options: ISelectOption[];
  addable?: boolean;
  onAdd?: (term: string) => void;
  reversed?: boolean;
  addText?: string;
}

const SearchableSelectBox: React.FC<ISelectBoxProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [isMouseIn, setIsMouseIn] = useState(false);

  const optionChanged = (option: ISelectOption) => {
    setIsOpen(false);
    if(props.onChange)
      props.onChange(option);
  }

  const addOptionClicked = (searchTerm: string) => {
    setSearchTerm("");
    setIsOpen(false);
    if(props.onAdd)
      props.onAdd(searchTerm);
  }

  useEffect(() => {
    setSearchTerm("");
  }, [isOpen]);

  const selectBoxClicked = () => {
    if(!isOpen) {
      searchRef.current?.focus();
    }
    setIsOpen(!isOpen);
  }

  let searchResults = props.options.filter(option => option.label.toLowerCase().includes(searchTerm.trim()) || option.value.toLowerCase().includes(searchTerm.trim()));

  return (
    <div className={cx(styles.selectBoxContainer, isOpen ? styles.open : "", props.reversed ? styles.reversed : "")} onMouseEnter={(e) => setIsMouseIn(true)} onMouseLeave={(e) => setIsMouseIn(false)}>
      <div className={styles.selectBox}>
        <div className={styles.selectedOption} onClick={() => selectBoxClicked()}>{props.defaultValue?.label || (<span className={styles.placeholder}>{props.placeholder || "Select an item"}</span>)}</div>
        <ul className={styles.options}>
          <li className={styles.searchInputContainer}>
            <input type="text" ref={searchRef} placeholder="Filter results" value={searchTerm} onBlur={(e) => setIsOpen(isMouseIn)} onChange={(e) => setSearchTerm(e.target.value)} />
          </li>
          {props.addable && searchTerm.trim().length ? (
            <li className={styles.option} onClick={(e) => addOptionClicked(searchTerm)}>{props.addText ? props.addText.replaceAll("{term}", searchTerm) : `Add "${searchTerm}"`}</li>
          ) : !searchResults.length ? (
            <li className={styles.noResults}>No results</li>
          ) : null}
          {searchResults.map(option => (
            <li key={option.label + option.value} className={styles.option} onClick={(e) => optionChanged(option)}>{option.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SearchableSelectBox;