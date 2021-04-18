import React, { FC, HTMLProps, ReactNode } from 'react'
import cx from 'classnames'
import { GrafanaTheme } from '@grafana/data'
import { useStyles } from '@grafana/ui'

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'css'> {
  children: ReactNode | ReactNode[]
}

export const InlineFieldRow: FC<Props> = ({ children, className, ...htmlProps }) => {
  return (
    <div className={cx('inline_field_row-container', className)} {...htmlProps}>
      {children}
    </div>
  )
}
