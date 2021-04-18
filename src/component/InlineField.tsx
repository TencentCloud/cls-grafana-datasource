import React, { FC } from 'react'
import cx from 'classnames'
import { FieldProps } from '@grafana/ui/components/Forms/Field'
import { useTheme } from '@grafana/ui'
import { InlineLabel } from './InlineLabel'

export interface Props extends Omit<FieldProps, 'css' | 'horizontal' | 'description' | 'error'> {
  /** Content for the label's tooltip */
  tooltip?: string | React.ReactElement<any>
  /** Custom width for the label */
  labelWidth?: number | 'auto'
  /** Make field's background transparent */
  transparent?: boolean
}

export const InlineField: FC<Props> = ({
  children,
  label,
  tooltip,
  labelWidth = 'auto',
  invalid,
  loading,
  disabled,
  className,
  transparent,
  ...htmlProps
}) => {
  const theme = useTheme()

  const labelElement =
    typeof label === 'string' ? (
      <InlineLabel
        width={labelWidth}
        tooltip={typeof tooltip === 'string' ? <span>{tooltip}</span> : tooltip}
        transparent={transparent}
      >
        {label}
      </InlineLabel>
    ) : (
      label
    )

  return (
    <div className={cx('inline_field-container', className)} {...htmlProps}>
      {labelElement}
      {React.cloneElement(children, { invalid, disabled, loading })}
    </div>
  )
}

InlineField.displayName = 'InlineField'
