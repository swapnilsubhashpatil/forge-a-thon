import type { Film } from './film'
import { Scene } from './Scene'
import { LOOP_S, camera, chapters, cursor } from './script'

export const tour: Film = { id: 'tour', duration: LOOP_S, chapters, camera, cursor, render: (t) => <Scene t={t} /> }
