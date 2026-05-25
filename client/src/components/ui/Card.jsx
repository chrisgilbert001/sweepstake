import './Card.css';

/**
 * Card component with elevation variants and optional hover effect.
 *
 * @param {object} props
 * @param {'flat' | 'raised' | 'prominent'} [props.elevation='raised'] - Shadow elevation level
 * @param {boolean} [props.hoverable=false] - Enables hover lift effect
 * @param {'default' | 'compact'} [props.padding='default'] - Responsive padding size
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} props.children
 */
export default function Card({
  elevation = 'raised',
  hoverable = false,
  padding = 'default',
  className,
  children,
}) {
  const classes = [
    'card',
    `card--${elevation}`,
    hoverable && 'card--hoverable',
    padding === 'compact' && 'card--compact',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}
