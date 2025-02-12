'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, RotateCcw, Plus, Edit, Trash, PenTool, Save, Undo, HelpCircle, Video } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Player = {
  id: number
  x: number
  y: number
  color: string
  name: string
}

type Ball = {
  x: number
  y: number
}

type Movement = {
  playerId?: number
  start: { x: number; y: number }
  end: { x: number; y: number }
  isSimultaneous: boolean
}

type Action = {
  id: number
  movements: Movement[]
  ballSpeed: 'slow' | 'medium' | 'fast'
  ballDirection: 'straight' | 'lob' | 'wall'
}

const COURT_WIDTH = 800
const COURT_HEIGHT = 400

const INITIAL_PLAYERS: Player[] = [
  { id: 1, x: 100, y: 100, color: '#ef4444', name: 'Player 1' },
  { id: 2, x: 100, y: 300, color: '#ef4444', name: 'Player 2' },
  { id: 3, x: 700, y: 100, color: '#22c55e', name: 'Player 3' },
  { id: 4, x: 700, y: 300, color: '#22c55e', name: 'Player 4' },
]

export function PadelSimulator() {
  const [showTutorial, setShowTutorial] = useState(true)
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS)
  const [ball, setBall] = useState<Ball>({ x: 400, y: 200 })
  const [actions, setActions] = useState<Action[]>([])
  const [currentAction, setCurrentAction] = useState<Action | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  const [playerSpeed, setPlayerSpeed] = useState(5)
  const [ballSpeed, setBallSpeed] = useState<'slow' | 'medium' | 'fast'>('medium')
  const [ballDirection, setBallDirection] = useState<'straight' | 'lob' | 'wall'>('straight')
  const [isDrawing, setIsDrawing] = useState(false)
  const [showArrows, setShowArrows] = useState(true)
  const [isPenToolActive, setIsPenToolActive] = useState(false)
  const [freeDrawings, setFreeDrawings] = useState<Movement[]>([])
  const [isDraggingBall, setIsDraggingBall] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  type HistoryEntry = 
    | { type: 'add_movement'; data: Movement }
    | { type: 'action'; data: Action[] }
    | { type: 'reset'; data: { actions: Action[]; players: Player[]; ball: Ball } }
    | { type: 'edit'; data: { actionId: number; action: Action } }
    | { type: 'delete'; data: Action }

  const [history, setHistory] = useState<HistoryEntry[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const drawCourt = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court background
    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court walls
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court lines
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.beginPath()

    // Center line
    ctx.moveTo(COURT_WIDTH / 2, 0)
    ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT)

    // Service lines
    ctx.moveTo(100, 0)
    ctx.lineTo(100, COURT_HEIGHT)
    ctx.moveTo(COURT_WIDTH - 100, 0)
    ctx.lineTo(COURT_WIDTH - 100, COURT_HEIGHT)

    // Middle service line
    ctx.moveTo(100, COURT_HEIGHT / 2)
    ctx.lineTo(COURT_WIDTH - 100, COURT_HEIGHT / 2)

    ctx.stroke()

    // Draw grid for better position reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i < COURT_WIDTH; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, COURT_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i < COURT_HEIGHT; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(COURT_WIDTH, i)
      ctx.stroke()
    }

    // Draw players with shadows
    players.forEach((player) => {
      // Draw shadow
      ctx.beginPath()
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.arc(player.x + 2, player.y + 2, 12, 0, Math.PI * 2)
      ctx.fill()

      // Draw player
      ctx.beginPath()
      ctx.fillStyle = player.color
      ctx.arc(player.x, player.y, 12, 0, Math.PI * 2)
      ctx.fill()

      // Draw player number
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(player.id.toString(), player.x, player.y)
    })

    // Draw ball with shadow
    ctx.beginPath()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.arc(ball.x + 2, ball.y + 2, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.fillStyle = '#ffeb3b'
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2)
    ctx.fill()

    if (showArrows) {
      // Draw actions
      actions.forEach((action, index) => {
        action.movements.forEach((move) => {
          drawArrow(ctx, move.start.x, move.start.y, move.end.x, move.end.y, 
            move.playerId ? (move.isSimultaneous ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.8)') 
            : (move.isSimultaneous ? 'rgba(255, 165, 0, 0.6)' : 'rgba(255, 165, 0, 0.8)'))
        })
        
        // Draw action number
        const lastMove = action.movements[action.movements.length - 1]
        const midX = (lastMove.start.x + lastMove.end.x) / 2
        const midY = (lastMove.start.y + lastMove.end.y) / 2
        ctx.fillStyle = 'white'
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(midX, midY, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = 'black'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((index + 1).toString(), midX, midY)
      })

      // Draw current action
      if (currentAction && isDrawing) {
        currentAction.movements.forEach((move) => {
          drawArrow(ctx, move.start.x, move.start.y, move.end.x, move.end.y, 
            move.playerId ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 165, 0, 0.4)')
        })
      }
    }

    // Draw free-form drawings
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    freeDrawings.forEach((drawing) => {
      ctx.beginPath()
      ctx.moveTo(drawing.start.x, drawing.start.y)
      ctx.lineTo(drawing.end.x, drawing.end.y)
      ctx.stroke()
    })

    // Draw tutorial overlay if enabled
    if (showTutorial) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT)
      ctx.fillStyle = 'white'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Welcome to Padel Tactical Simulator!', COURT_WIDTH / 2, COURT_HEIGHT / 2 - 40)
      ctx.font = '16px Arial'
      ctx.fillText('1. Select a player or ball from the toolbox', COURT_WIDTH / 2, COURT_HEIGHT / 2)
      ctx.fillText('2. Click and drag on the court to create movements', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 30)
      ctx.fillText('3. Use the controls below to adjust speed and direction', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 60)
      ctx.fillText('Click anywhere to start', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 100)
    }
  }, [players, ball, actions, currentAction, showArrows, freeDrawings, showTutorial, isDrawing])

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    drawCourt()
  }, [players, ball, actions, currentAction, showArrows, freeDrawings, drawCourt])

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const stream = canvas.captureStream(30) // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    })
    
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `padel-simulation-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      chunksRef.current = []
      setRecordingDuration(0)
    }

    mediaRecorder.start()
    setIsRecording(true)

    // Clear canvas for recording
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court background
    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court walls
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, COURT_WIDTH, COURT_HEIGHT)

    // Draw court lines
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.beginPath()

    // Center line
    ctx.moveTo(COURT_WIDTH / 2, 0)
    ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT)

    // Service lines
    ctx.moveTo(100, 0)
    ctx.lineTo(100, COURT_HEIGHT)
    ctx.moveTo(COURT_WIDTH - 100, 0)
    ctx.lineTo(COURT_WIDTH - 100, COURT_HEIGHT)

    // Middle service line
    ctx.moveTo(100, COURT_HEIGHT / 2)
    ctx.lineTo(COURT_WIDTH - 100, COURT_HEIGHT / 2)


    ctx.stroke()

    // Draw grid for better position reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i < COURT_WIDTH; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, COURT_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i < COURT_HEIGHT; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(COURT_WIDTH, i)
      ctx.stroke()
    }

    // Draw players with shadows
    players.forEach((player) => {
      // Draw shadow
      ctx.beginPath()
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.arc(player.x + 2, player.y + 2, 12, 0, Math.PI * 2)
      ctx.fill()

      // Draw player
      ctx.beginPath()
      ctx.fillStyle = player.color
      ctx.arc(player.x, player.y, 12, 0, Math.PI * 2)
      ctx.fill()

      // Draw player number
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(player.id.toString(), player.x, player.y)
    })

    // Draw ball with shadow
    ctx.beginPath()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.arc(ball.x + 2, ball.y + 2, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.fillStyle = '#ffeb3b'
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2)
    ctx.fill()

    if (showArrows) {
      // Draw actions
      actions.forEach((action, index) => {
        action.movements.forEach((move) => {
          drawArrow(ctx, move.start.x, move.start.y, move.end.x, move.end.y, 
            move.playerId ? (move.isSimultaneous ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.8)') 
            : (move.isSimultaneous ? 'rgba(255, 165, 0, 0.6)' : 'rgba(255, 165, 0, 0.8)'))
        })
        
        // Draw action number
        const lastMove = action.movements[action.movements.length - 1]
        const midX = (lastMove.start.x + lastMove.end.x) / 2
        const midY = (lastMove.start.y + lastMove.end.y) / 2
        ctx.fillStyle = 'white'
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(midX, midY, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = 'black'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((index + 1).toString(), midX, midY)
      })

      // Draw current action
      if (currentAction && isDrawing) {
        currentAction.movements.forEach((move) => {
          drawArrow(ctx, move.start.x, move.start.y, move.end.x, move.end.y, 
            move.playerId ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 165, 0, 0.4)')
        })
      }
    }

    // Draw free-form drawings
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    freeDrawings.forEach((drawing) => {
      ctx.beginPath()
      ctx.moveTo(drawing.start.x, drawing.start.y)
      ctx.lineTo(drawing.end.x, drawing.end.y)
      ctx.stroke()
    })

    // Draw tutorial overlay if enabled
    if (showTutorial) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT)
      ctx.fillStyle = 'white'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Welcome to Padel Tactical Simulator!', COURT_WIDTH / 2, COURT_HEIGHT / 2 - 40)
      ctx.font = '16px Arial'
      ctx.fillText('1. Select a player or ball from the toolbox', COURT_WIDTH / 2, COURT_HEIGHT / 2)
      ctx.fillText('2. Click and drag on the court to create movements', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 30)
      ctx.fillText('3. Use the controls below to adjust speed and direction', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 60)
      ctx.fillText('Click anywhere to start', COURT_WIDTH / 2, COURT_HEIGHT / 2 + 100)
    }
  }

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) => {
    const headLength = 15
    const dx = toX - fromX
    const dy = toY - fromY
    const angle = Math.atan2(dy, dx)
    
    // Draw arrow line with gradient
    const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, color)
    
    ctx.strokeStyle = gradient
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()

    // Draw arrow head
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showTutorial) {
      setShowTutorial(false)
      return
    }

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2) <= 10) {
      setIsDraggingBall(true)
      return
    }

    setIsDrawing(true)

    if (isPenToolActive) {
      setFreeDrawings([...freeDrawings, { start: { x, y }, end: { x, y }, isSimultaneous: false }])
    } else {
      if (!currentAction) {
        setCurrentAction({
          id: Date.now(),
          movements: [],
          ballSpeed,
          ballDirection,
        })
      }
      setCurrentAction(prev => {
        if (!prev) return null
        return {
          ...prev,
          movements: [
            ...prev.movements,
            {
              playerId: selectedPlayer ?? undefined,
              start: { x, y },
              end: { x, y },
              isSimultaneous: false,
            },
          ],
        }
      })
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDraggingBall) {
      setBall({ x, y })
      return
    }

    if (!isDrawing) return

    if (isPenToolActive) {
      setFreeDrawings(prev => {
        const newDrawings = [...prev]
        newDrawings[newDrawings.length - 1].end = { x, y }
        return newDrawings
      })
    } else {
      setCurrentAction(prev => {
        if (!prev) return null
        const newMovements = [...prev.movements]
        newMovements[newMovements.length - 1].end = { x, y }
        return { ...prev, movements: newMovements }
      })
    }
  }

  const handleCanvasMouseUp = () => {
    setIsDrawing(false)
    setIsDraggingBall(false)
    if (currentAction && currentAction.movements.length > 0) {
      setHistory([...history, { type: 'add_movement', data: { ...currentAction.movements[currentAction.movements.length - 1] } }])
    }
  }

  const handleSaveAction = () => {
    if (currentAction) {
      setHistory([...history, { type: 'action', data: actions }])
      setActions(prev => [...prev, currentAction])
      setCurrentAction(null)
    }
  }

  const updatePosition = (movement: Movement, progress: number) => {
    if (movement.playerId) {
      setPlayers(prevPlayers =>
        prevPlayers.map(player =>
          player.id === movement.playerId
            ? {
                ...player,
                x: movement.start.x + (movement.end.x - movement.start.x) * progress,
                y: movement.start.y + (movement.end.y - movement.start.y) * progress,
              }
            : player
        )
      )
    } else {
      const x = movement.start.x + (movement.end.x - movement.start.x) * progress
      const y = movement.start.y + (movement.end.y - movement.start.y) * progress
      
      // Add arc effect for lob shots
      if (ballDirection === 'lob') {
        const midPoint = progress * Math.PI
        const heightOffset = Math.sin(midPoint) * 50 // Maximum height of 50px
        setBall({ x, y: y - heightOffset })
      } else {
        setBall({ x, y })
      }
    }
  }

  const handleReset = () => {
    setHistory([...history, { type: 'reset', data: { actions, players, ball } }])
    setActions([])
    setCurrentAction(null)
    setIsPlaying(false)
    setShowArrows(true)
    setPlayers(INITIAL_PLAYERS)
    setBall({ x: 400, y: 200 })
    setFreeDrawings([])
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }

  const handleUndo = () => {
    if (history.length === 0) return

    const newHistory = [...history]
    const last = newHistory.pop()
    if (!last) return

    setHistory(newHistory)

    switch (last.type) {
      case 'add_movement':
        if (currentAction) {
          setCurrentAction({
            ...currentAction,
            movements: currentAction.movements.slice(0, -1)
          })
        }
        break
      case 'action':
        setActions(last.data)
        break
      case 'reset':
        setActions(last.data.actions)
        setPlayers(last.data.players)
        setBall(last.data.ball)
        break
      case 'edit':
        setActions(prev => [...prev, last.data.action])
        setCurrentAction(null)
        break
      case 'delete':
        setActions(prev => [...prev, last.data])
        break
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    setShowArrows(false)
    if (isRecording) {
      startRecording()
    }
    let currentActionIndex = 0
    let currentMovementIndex = 0
    let progress = 0

    const animate = () => {
      if (currentActionIndex >= actions.length) {
        setIsPlaying(false)
        setShowArrows(true)
        if (isRecording) {
          stopRecording()
        }
        return
      }

      const action = actions[currentActionIndex]
      const speed = action.ballSpeed === 'slow' ? 0.01 : action.ballSpeed === 'medium' ? 0.02 : 0.03
      
      if (currentMovementIndex >= action.movements.length) {
        currentActionIndex++
        currentMovementIndex = 0
        progress = 0
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      const simultaneousMovements = []
      let nextSequentialIndex = currentMovementIndex

      while (nextSequentialIndex < action.movements.length && action.movements[nextSequentialIndex].isSimultaneous) {
        simultaneousMovements.push(action.movements[nextSequentialIndex])
        nextSequentialIndex++
      }

      progress += speed
      if (progress >= 1) {
        progress = 0
        currentMovementIndex = nextSequentialIndex
        if (simultaneousMovements.length === 0) {
          currentMovementIndex++
        }
      }

      simultaneousMovements.forEach(movement => {
        updatePosition(movement, progress)
      })

      if (simultaneousMovements.length === 0 && currentMovementIndex < action.movements.length) {
        updatePosition(action.movements[currentMovementIndex], progress)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
  }

  const handlePause = () => {
    setIsPlaying(false)
    setShowArrows(true)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (isRecording) {
      stopRecording()
    }
  }

  // ... [Rest of the component remains the same until the buttons section]

  return (
    <div className="flex flex-col items-center p-4 space-y-6 bg-gray-900 text-white min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1">
          <div className="relative bg-white rounded-lg shadow-md overflow-hidden">
            <canvas
              ref={canvasRef}
              width={COURT_WIDTH}
              height={COURT_HEIGHT}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className="cursor-crosshair"
            />
            {isRecording && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span>{formatDuration(recordingDuration)}</span>
              </div>
            )}
            <div className="absolute top-4 right-4 flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setShowTutorial(true)}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Show Tutorial</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handlePlay} disabled={isPlaying}>
                    <Play className="mr-2 h-4 w-4" /> Play
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Play the simulation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handlePause} disabled={!isPlaying}>
                    <Pause className="mr-2 h-4 w-4" /> Pause
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pause the simulation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset all actions</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setCurrentAction(null)}>
                    <Plus className="mr-2 h-4 w-4" /> New Action
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start a new action sequence</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveAction} disabled={!currentAction}>
                    <Save className="mr-2 h-4 w-4" /> Save Action
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save the current action sequence</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setIsPenToolActive(!isPenToolActive)}>
                    <PenTool className="mr-2 h-4 w-4" /> {isPenToolActive ? 'Disable' : 'Enable'} Pen Tool
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle free-form drawing mode</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleUndo}>
                    <Undo className="mr-2 h-4 w-4" /> Undo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo last action</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setIsRecording(!isRecording)}
                    variant={isRecording ? "destructive" : "default"}
                  >
                    <Video className="mr-2 h-4 w-4" /> {isRecording ? 'Stop Recording' : 'Record'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? 'Stop recording simulation' : 'Record simulation as video'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-gray-800 rounded-lg shadow-md p-4 text-white">
            <h3 className="font-semibold mb-4">Toolbox</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Select Player/Ball</h4>
                <div className="grid grid-cols-2 gap-2">
                  {players.map((player) => (
                    <Button
                      key={player.id}
                      variant={selectedPlayer === player.id ? "default" : "outline"}
                      onClick={() => setSelectedPlayer(player.id)}
                      className="w-full"
                      style={{
                        borderColor: player.color,
                        ...(selectedPlayer === player.id && { backgroundColor: player.color })
                      }}
                    >
                      {player.name}
                    </Button>
                  ))}
                  <Button
                    variant={selectedPlayer === null ? "default" : "outline"}
                    onClick={() => setSelectedPlayer(null)}
                    className="w-full col-span-2"
                    style={{
                      borderColor: '#ffeb3b',
                      ...(selectedPlayer === null && { backgroundColor: '#ffeb3b', color: 'black' })
                    }}
                  >
                    Ball
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Player Speed</h4>
                <Slider
                  value={[playerSpeed]}
                  onValueChange={(value) => setPlayerSpeed(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="mb-4"
                />
                <div className="text-xs text-muted-foreground text-center">
                  {playerSpeed === 1 ? 'Slow' : playerSpeed === 10 ? 'Fast' : 'Medium'}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Ball Speed</h4>
                <Select value={ballSpeed} onValueChange={(value: 'slow' | 'medium' | 'fast') => setBallSpeed(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Ball Direction</h4>
                <Select value={ballDirection} onValueChange={(value: 'straight' | 'lob' | 'wall') => setBallDirection(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight">Straight</SelectItem>
                    <SelectItem value="lob">Lob</SelectItem>
                    <SelectItem value="wall">Wall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-md p-4 text-white">
            <h3 className="font-semibold mb-4">Notes</h3>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add notes about your tactical scenario..."
              className="mb-2"
            />
          </div>

          <div className="bg-gray-800 rounded-lg shadow-md p-4 text-white">
            <h3 className="font-semibold mb-4">Action Sequence</h3>
            <div className="space-y-2">
              {actions.map((action, actionIndex) => (
                <div key={action.id} className="bg-gray-700 p-2 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Action {actionIndex + 1}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setHistory([...history, { type: 'edit', data: { actionId: action.id, action } }])
                          setCurrentAction(action)
                          setActions(actions.filter(a => a.id !== action.id))
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setHistory([...history, { type: 'delete', data: action }])
                          setActions(actions.filter(a => a.id !== action.id))
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {action.movements.length} movement{action.movements.length !== 1 ? 's' : ''}
                    {action.movements.some(m => !m.playerId) && ' • Ball movement'}
                    {action.movements.some(m => m.playerId) && ' • Player movement'}
                  </div>
                </div>
              ))}
              {actions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No actions yet. Create a new action to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
