export function wrap ( min: number, max: number, val: number ): number {
  if      ( val > max ) return min + ( val - max )
  else if ( val < min ) return max + ( min - val )
  else                  return val
}
