import React from 'react';
import styles from './styles.module.css';

type Props = {
  children?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  target?: string;
  rel?: string;
};

export default function DocButton({
  children,
  href,
  onClick,
  variant = 'primary',
  className = '',
  target,
  rel,
}: Props) {
  const cls = `${styles.button} ${styles[variant]} ${className}`.trim();

  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} target={target} rel={rel}>
        {children}
      </a>
    );
  }

  return (
    // eslint-disable-next-line react/button-has-type
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
