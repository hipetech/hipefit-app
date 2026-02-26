import { View } from 'react-native';

import { cn } from '@/lib/utils';

interface ProgressProps {
  value?: number;
  className?: string;
  indicatorClassName?: string;
}

export function Progress({
  value = 0,
  className,
  indicatorClassName,
}: ProgressProps) {
  return (
    <View
      className={cn(
        'bg-default/20 h-2 w-full overflow-hidden rounded-full',
        className
      )}
    >
      <View
        className={cn('bg-foreground h-full rounded-full', indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </View>
  );
}
