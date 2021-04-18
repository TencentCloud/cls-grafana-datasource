import React, { FunctionComponent } from 'react'
import { GrafanaTheme } from '@grafana/data'
import cx from 'classnames'
import { LabelProps } from '@grafana/ui/components/Forms/Label'
import { Icon, useTheme, Tooltip } from '@grafana/ui'

export interface Props extends Omit<LabelProps, 'css' | 'description' | 'category'> {
  /** Content for the labels tooltip. If provided, an info icon with the tooltip content
   * will be displayed */
  tooltip?: string | React.ReactElement<any>
  /** Custom width for the label */
  width?: number | 'auto'
  /** Make labels's background transparent */
  transparent?: boolean
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isFocused?: boolean
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isInvalid?: boolean
  /** @beta */
  /** Controls which element the InlineLabel should be rendered into */
  as?: React.ElementType
}

export const InlineLabel: FunctionComponent<Props> = ({
  children,
  className,
  tooltip,
  width,
  transparent,
  as: Component = 'label',
  style,
  ...rest
}) => {
  const theme = useTheme()
  const styles = getInlineLabelStyles(theme, transparent, width)
  return (
    <Component className={cx(className)} style={{ ...styles.label, ...style }} {...rest}>
      {children}
      {tooltip && (
        <Tooltip content={typeof tooltip === 'string' ? <span>{tooltip}</span> : tooltip}>
          <Icon name="info-circle" size="sm" style={styles.icon} />
        </Tooltip>
      )}
    </Component>
  )
}

export const getInlineLabelStyles = (
  theme: GrafanaTheme,
  transparent = false,
  width?: number | 'auto'
) => {
  return {
    label: {
      display: `flex`,
      alignItems: `center`,
      justifyContent: `space-between`,
      flexShrink: 0,
      padding: `0 ${theme.spacing.sm}`,
      fontWeight: `${theme.typography.weight.semibold}`,
      fontSize: `${theme.typography.size.sm}`,
      backgroundColor: `${transparent ? 'transparent' : theme.colors.bg2}`,
      height: `${theme.height.md}px`,
      lineHeight: `${theme.height.md}px`,
      marginRight: `${theme.spacing.xs}`,
      borderRadius: `${theme.border.radius.md}`,
      border: `none`,
      width: `${width ? (width !== 'auto' ? `${8 * width}px` : width) : '100%'}`,
      color: `${theme.colors.textHeading}`,
    },
    icon: {
      color: `${theme.colors.textWeak}`,
      marginLeft: '10px',
      ':hover': {
        color: `${theme.colors.text}`,
      },
    },
  }
}
