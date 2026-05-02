// 🧠 CANVAS HOOK ARCHITECTURE EXPLAINED
// This hook is the "brain" of your drawing application
// It manages ALL user interactions: drawing, selecting, moving, zooming, panning
// Think of it as the conductor of an orchestra - it coordinates everything

import { useRef, useEffect, useState } from 'react'
import type React from 'react'
import { useDispatch } from 'react-redux'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import type { AppDispatch } from '@/redux/store'
import {
  wheelZoom,
  wheelPan,
  panStart,
  panMove,
  panEnd,
  handToolEnable,
  handToolDisable,
  screenToWorld,
  type Point,
} from '@/redux/slice/viewport'
import { toast } from 'sonner'
import { useGenerateWorkflowMutation } from '@/redux/api/generation'
import { exportGeneratedUIAsPNG } from '@/lib/frame-snapshot'
import {
  setTool,
  addFrame,
  addRect,
  addEllipse,
  addFreeDrawShape,
  addArrow,
  addLine,
  addText,
  selectShape,
  clearSelection,
  selectAll,
  updateShape,
  removeShape,
  type Tool,
  type Shape,
  FrameShape,
  addGeneratedUI,
} from '@/redux/slice/shapes'
import { downloadBlob, generateFrameSnapshot, buildShapeDescription } from '@/lib/frame-snapshot'
import { nanoid } from '@reduxjs/toolkit'
import {
  addErrorMessage,
  addUserMessage,
  clearChat,
  finishStreamingResponse,
  initializeChat,
  startStreamingResponse,
  updateStreamingContent,
} from '@/redux/slice/chat'

// 📝 INTERFACES - Type definitions for our data structures
interface DraftShape {
  type: 'frame' | 'rect' | 'ellipse' | 'arrow' | 'line'
  startWorld: Point
  currentWorld: Point
}

interface TouchPointer {
  id: number
  p: Point
}

// 🎬 PERFORMANCE CONSTANTS - Control animation frame rates
const RAF_INTERVAL_MS = 8 // its a fps cap

export const useInspiration = () => {
  const [isInspirationOpen, setIsInspirationOpen] = useState(false)

  const toggleInspiration = () => {
    setIsInspirationOpen(!isInspirationOpen)
  }

  const openInspiration = () => {
    setIsInspirationOpen(true)
  }

  const closeInspiration = () => {
    setIsInspirationOpen(false)
  }

  return {
    isInspirationOpen,
    toggleInspiration,
    openInspiration,
    closeInspiration,
  }
}

// 🎯 SECTION 1: HOOK SETUP AND STATE CONNECTION
// This is where we connect to Redux and get all our app's data
export const useInfiniteCanvas = () => {
  // Redux connection - this is how we talk to our global state
  const dispatch = useDispatch<AppDispatch>()

  // 🖼️ VIEWPORT STATE - Controls zoom, pan, and camera position
  // This is like the "camera" that looks at your canvas
  // It tracks where you're looking (translate) and how zoomed in you are (scale)
  const viewport = useAppSelector((s) => s.viewport)

  // 🎨 SHAPES STATE - All the drawings on your canvas
  // Redux stores shapes in a "normalized" format (like a database)
  // We convert it to a simple array for easy rendering
  const entityState = useAppSelector((s) => s.shapes.present.shapes)
  const shapeList: Shape[] = entityState.ids
    .map((id: string) => entityState.entities[id])
    .filter((s: Shape | undefined): s is Shape => Boolean(s))

  // 🛠️ TOOL STATE - What tool the user is currently using
  // This determines what happens when they click or drag
  const currentTool = useAppSelector((s) => s.shapes.present.tool)
  const selectedShapes = useAppSelector((s) => s.shapes.present.selected)

  // 📱 SIDEBAR STATE - Controls the text editing sidebar
  // This opens automatically when text is selected
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const shapesEntities = useAppSelector((state) => state.shapes.present.shapes.entities)

  // 🔍 TEXT DETECTION - Check if any selected shape is text
  // This is used to automatically open the text editing sidebar
  const hasSelectedText = Object.keys(selectedShapes).some((id) => {
    const shape = shapesEntities[id]
    return shape?.type === 'text'
  })

  useEffect(() => {
    if (hasSelectedText && !isSidebarOpen) {
      setIsSidebarOpen(true)
    } else if (!hasSelectedText) {
      setIsSidebarOpen(false)
    }
  }, [hasSelectedText, isSidebarOpen])

  // 🎯 SECTION 2: REFS - "Memory" for the hook
  // Refs are like sticky notes that remember values between renders
  // They don't cause re-renders when changed, perfect for tracking state

  // 🖼️ CANVAS REF - Reference to the actual canvas DOM element
  // This is how we know where the user clicked and get canvas dimensions
  const canvasRef = useRef<HTMLDivElement | null>(null)

  // 👆 TOUCH REF - Tracks multiple finger touches (for mobile)
  // Maps touch IDs to touch data for multi-touch support
  const touchMapRef = useRef<Map<number, TouchPointer>>(new Map())

  // ✏️ DRAFT SHAPE REF - The shape being drawn (before it's finalized)
  // This is the "preview" shape that follows your mouse while drawing
  const draftShapeRef = useRef<DraftShape | null>(null)

  // 🖌️ FREE DRAW POINTS REF - Points for freehand drawing
  // Stores all the mouse/touch points for smooth freehand lines
  const freeDrawPointsRef = useRef<Point[]>([])

  // ⌨️ KEYBOARD STATE REFS - Track keyboard shortcuts
  // These remember if keys are pressed without causing re-renders
  const isSpacePressed = useRef(false)

  // 🎯 INTERACTION STATE REFS - Track what the user is doing
  // These prevent conflicts between different interactions
  const isDrawingRef = useRef(false) // User is drawing a shape
  const isMovingRef = useRef(false) // User is moving shapes
  const moveStartRef = useRef<Point | null>(null) // Where movement started

  // 📍 INITIAL POSITIONS REF - Remembers where shapes were before moving
  // This is crucial for smooth shape movement - we need to know the starting point
  const initialShapePositionsRef = useRef<
    Record<
      string,
      {
        x?: number
        y?: number
        points?: Point[]
        startX?: number
        startY?: number
        endX?: number
        endY?: number
      }
    >
  >({})

  // 🗑️ ERASER STATE REFS - Track eraser tool usage
  // Prevents deleting the same shape multiple times in one drag
  const isErasingRef = useRef(false)
  const erasedShapesRef = useRef<Set<string>>(new Set())

  // 📏 RESIZE STATE REFS - Track shape resizing
  // Stores resize data to calculate new dimensions smoothly
  const isResizingRef = useRef(false)
  const resizeDataRef = useRef<{
    shapeId: string
    corner: string
    initialBounds: { x: number; y: number; w: number; h: number }
    startPoint: { x: number; y: number }
  } | null>(null)

  // 🎬 ANIMATION FRAME REFS - Control smooth animations
  // These manage the 60fps animation loop for smooth drawing and panning
  const lastFreehandFrameRef = useRef(0)
  const freehandRafRef = useRef<number | null>(null)
  const panRafRef = useRef<number | null>(null)
  const pendingPanPointRef = useRef<Point | null>(null)

  // 🎯 SECTION 3: UTILITY FUNCTIONS
  // These are helper functions that make the code cleaner and more readable

  // 🔄 FORCE RENDER - Triggers a re-render for draft shapes
  // This is needed because draft shapes aren't in Redux yet
  const [, force] = useState(0)
  const requestRender = (): void => {
    force((n) => (n + 1) | 0)
  }

  // 📍 COORDINATE CONVERSION - Convert screen coordinates to canvas coordinates
  // This is crucial because the canvas might be zoomed or panned
  const localPointFromClient = (clientX: number, clientY: number): Point => {
    const el = canvasRef.current
    if (!el) return { x: clientX, y: clientY }
    const r = el.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  // 🎯 BLUR TEXT INPUT - Remove focus from text inputs
  // This prevents keyboard shortcuts from interfering with text editing
  const blurActiveTextInput = () => {
    const activeElement = document.activeElement
    if (activeElement && activeElement.tagName === 'INPUT') {
      ;(activeElement as HTMLInputElement).blur()
    }
  }

  type WithClientXY = { clientX: number; clientY: number }
  const getLocalPointFromPtr = (e: WithClientXY): Point =>
    localPointFromClient(e.clientX, e.clientY)

  // 🎯 SECTION 4: SHAPE HIT TESTING
  // This is how we figure out which shape the user clicked on
  // It's like a "collision detection" system for shapes

  // 🎯 GET SHAPE AT POINT - Find which shape is under the mouse
  // We check shapes in reverse order (top to bottom) to get the topmost shape
  const getShapeAtPoint = (worldPoint: Point): Shape | null => {
    // Iterate in rever // se order to check top shapes first
    for (let i = shapeList.length - 1; i >= 0; i--) {
      const shape = shapeList[i]
      if (isPointInShape(worldPoint, shape)) {
        return shape
      }
    }
    return null
  }

  // 🎯 POINT IN SHAPE - Check if a point is inside a specific shape
  // Each shape type has different hit testing logic
  const isPointInShape = (point: Point, shape: Shape): boolean => {
    switch (shape.type) {
      case 'frame':
      case 'rect':
      case 'ellipse':
      case 'generatedui':
        // For rectangular shapes, check if point is within bounds
        return (
          point.x >= shape.x &&
          point.x <= shape.x + shape.w &&
          point.y >= shape.y &&
          point.y <= shape.y + shape.h
        )
      case 'freedraw':
        // For freehand, check if point is near any line segment
        // This is more complex because freehand shapes are made of many points
        const threshold = 5
        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i]
          const p2 = shape.points[i + 1]
          if (distanceToLineSegment(point, p1, p2) <= threshold) {
            return true
          }
        }
        return false
      case 'arrow':
      case 'line':
        // For arrows and lines, check if point is near the line
        // We use a threshold to make lines easier to click
        const lineThreshold = 8
        return (
          distanceToLineSegment(
            point,
            { x: shape.startX, y: shape.startY },
            { x: shape.endX, y: shape.endY }
          ) <= lineThreshold
        )
      case 'text':
        // For text, use approximate bounding box with minimum clickable area
        // Text shapes need special handling because they can be very small
        const textWidth = Math.max(
          shape.text.length * (shape.fontSize * 0.6),
          100
        ) // Minimum 100px width
        const textHeight = shape.fontSize * 1.2
        const padding = 8 // Account for px-2 py-1 padding
        return (
          point.x >= shape.x - 2 &&
          point.x <= shape.x + textWidth + padding + 2 &&
          point.y >= shape.y - 2 &&
          point.y <= shape.y + textHeight + padding + 2
        )
      default:
        return false
    }
  }

  // 📏 DISTANCE TO LINE SEGMENT - Calculate distance from point to line
  // This is used for hit testing on lines and freehand shapes
  // It's a mathematical function that finds the closest point on a line
  const distanceToLineSegment = (
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number => {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) param = dot / lenSq

    let xx, yy
    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 🎯 SECTION 5: ANIMATION AND PERFORMANCE
  // These functions manage smooth animations and prevent performance issues

  // 🎬 SCHEDULE PAN MOVE - Smooth panning with requestAnimationFrame
  // This prevents panning from being choppy by using the browser's animation loop
  const schedulePanMove = (p: Point): void => {
    pendingPanPointRef.current = p
    if (panRafRef.current != null) return
    panRafRef.current = window.requestAnimationFrame(() => {
      panRafRef.current = null
      const next = pendingPanPointRef.current
      if (next) dispatch(panMove(next))
    })
  }

  // 🖌️ FREEHAND TICK - Smooth freehand drawing
  // This controls the frame rate for freehand drawing to prevent lag
  const freehandTick = (): void => {
    const now = performance.now()
    if (now - lastFreehandFrameRef.current >= RAF_INTERVAL_MS) {
      if (freeDrawPointsRef.current.length > 0) requestRender()
      lastFreehandFrameRef.current = now
    }
    if (isDrawingRef.current) {
      freehandRafRef.current = window.requestAnimationFrame(freehandTick)
    }
  }

  // 🎯 SECTION 6: WHEEL EVENTS (ZOOM AND PAN)
  // This handles mouse wheel for zooming and panning

  // 🎡 ON WHEEL - Handle mouse wheel for zoom and pan
  // Ctrl/Cmd + wheel = zoom, regular wheel = pan
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const originScreen = localPointFromClient(e.clientX, e.clientY)
    if (e.ctrlKey || e.metaKey) {
      // Zoom at mouse position
      dispatch(wheelZoom({ deltaY: e.deltaY, originScreen }))
    } else {
      // Pan the canvas
      const dx = e.shiftKey ? e.deltaY : e.deltaX
      const dy = e.shiftKey ? 0 : e.deltaY
      // Scroll moves content → invert deltas
      dispatch(wheelPan({ dx: -dx, dy: -dy }))
    }
  }

  // 🎯 SECTION 7: POINTER EVENTS (MAIN INTERACTION HANDLERS)
  // These are the core functions that handle all user interactions

  // 👆 ON POINTER DOWN - Handle mouse/touch down events
  // This is where we decide what action to take based on the current tool
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Don't prevent default if clicking on a button or interactive element
    // This prevents canvas interactions from interfering with UI buttons
    const target = e.target as HTMLElement
    const isButton =
      (target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.classList.contains('pointer-events-auto') ||
      target.closest('.pointer-events-auto')) &&
      !target.closest('.canvas-shape')

    if (!isButton) {
      e.preventDefault()
    } else {
      console.log(
        '🖱️ Not preventing default - clicked on interactive element:',
        target
      )
      return // Don't handle canvas interactions when clicking buttons
    }

    const local = getLocalPointFromPtr(e.nativeEvent)
    const world = screenToWorld(local, viewport.translate, viewport.scale)

    // Single-pointer interactions
    if (touchMapRef.current.size <= 1) {
      canvasRef.current?.setPointerCapture?.(e.pointerId)

      const isPanButton = e.button === 1 || e.button === 2
      const panByShift = isSpacePressed.current && e.button === 0

      if (isPanButton || panByShift) {
        const mode = isSpacePressed.current ? 'shiftPanning' : 'panning'
        dispatch(panStart({ screen: local, mode }))
        return
      }

      if (e.button === 0) {
        if (currentTool === 'select') {
          // SELECTION AND MOVEMENT LOGIC
          // This is the most complex part - it handles selecting and moving shapes
          const hitShape = getShapeAtPoint(world)
          if (hitShape) {
            const isAlreadySelected = selectedShapes[hitShape.id]
            if (!isAlreadySelected) {
              if (!e.shiftKey) dispatch(clearSelection())
              dispatch(selectShape(hitShape.id))
            }
            // Start movement
            isMovingRef.current = true
            moveStartRef.current = world
            // Store initial positions of all selected shapes
            // This is crucial for smooth movement - we need to remember where everything started
            initialShapePositionsRef.current = {}
            Object.keys(selectedShapes).forEach((id) => {
              const shape = entityState.entities[id]
              if (shape) {
                if (
                  shape.type === 'frame' ||
                  shape.type === 'rect' ||
                  shape.type === 'ellipse' ||
                  shape.type === 'generatedui'
                ) {
                  initialShapePositionsRef.current[id] = {
                    x: shape.x,
                    y: shape.y,
                  }
                } else if (shape.type === 'freedraw') {
                  initialShapePositionsRef.current[id] = {
                    points: [...shape.points],
                  }
                } else if (shape.type === 'arrow' || shape.type === 'line') {
                  initialShapePositionsRef.current[id] = {
                    startX: shape.startX,
                    startY: shape.startY,
                    endX: shape.endX,
                    endY: shape.endY,
                  }
                } else if (shape.type === 'text') {
                  initialShapePositionsRef.current[id] = {
                    x: shape.x,
                    y: shape.y,
                  }
                }
              }
            })
            // Include the just-selected shape if it wasn't already selected
            if (
              hitShape.type === 'frame' ||
              hitShape.type === 'rect' ||
              hitShape.type === 'ellipse' ||
              hitShape.type === 'generatedui'
            ) {
              initialShapePositionsRef.current[hitShape.id] = {
                x: hitShape.x,
                y: hitShape.y,
              }
            } else if (hitShape.type === 'freedraw') {
              initialShapePositionsRef.current[hitShape.id] = {
                points: [...hitShape.points],
              }
            } else if (hitShape.type === 'arrow' || hitShape.type === 'line') {
              initialShapePositionsRef.current[hitShape.id] = {
                startX: hitShape.startX,
                startY: hitShape.startY,
                endX: hitShape.endX,
                endY: hitShape.endY,
              }
            } else if (hitShape.type === 'text') {
              initialShapePositionsRef.current[hitShape.id] = {
                x: hitShape.x,
                y: hitShape.y,
              }
            }
          } else {
            // Clicked on empty space - clear selection and blur any active text inputs
            if (!e.shiftKey) {
              dispatch(clearSelection())
              blurActiveTextInput()
            }
          }
        } else if (currentTool === 'eraser') {
          // ERASER TOOL - Start drag-to-delete mode
          isErasingRef.current = true
          erasedShapesRef.current.clear() // Reset erased shapes for new drag

          const hitShape = getShapeAtPoint(world)
          if (hitShape) {
            dispatch(removeShape(hitShape.id))
            erasedShapesRef.current.add(hitShape.id)
          } else {
            // Eraser clicked on empty space - blur any active text inputs
            blurActiveTextInput()
          }
        } else if (currentTool === 'text') {
          // TEXT TOOL - Create text at click position and auto-switch to select
          dispatch(addText({ x: world.x, y: world.y }))
          // Switch to select tool immediately
          dispatch(setTool('select'))
        } else {
          // DRAWING TOOLS - Start drawing a new shape
          isDrawingRef.current = true
          if (
            currentTool === 'frame' ||
            currentTool === 'rect' ||
            currentTool === 'ellipse' ||
            currentTool === 'arrow' ||
            currentTool === 'line'
          ) {
            console.log('Starting to draw:', currentTool, 'at:', world)
            draftShapeRef.current = {
              type: currentTool,
              startWorld: world,
              currentWorld: world,
            }
            requestRender()
          } else if (currentTool === 'freedraw') {
            freeDrawPointsRef.current = [world]
            lastFreehandFrameRef.current = performance.now()
            freehandRafRef.current = window.requestAnimationFrame(freehandTick)
            requestRender()
          }
        }
      }
    }
  }

  // 🎯 SECTION 8: POINTER MOVE - Handle mouse/touch movement
  // This updates shapes in real-time as the user drags

  // 👆 ON POINTER MOVE - Handle mouse/touch movement
  // This is where we update shapes in real-time as the user drags
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const local = getLocalPointFromPtr(e.nativeEvent)
    const world = screenToWorld(local, viewport.translate, viewport.scale)

    // Pan
    if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
      schedulePanMove(local)
      return
    }

    // Eraser drag-to-delete
    if (isErasingRef.current && currentTool === 'eraser') {
      const hitShape = getShapeAtPoint(world)
      if (hitShape && !erasedShapesRef.current.has(hitShape.id)) {
        // Delete the shape if we haven't already deleted it in this drag
        dispatch(removeShape(hitShape.id))
        erasedShapesRef.current.add(hitShape.id)
      }
    }

    // Shape movement
    if (
      isMovingRef.current &&
      moveStartRef.current &&
      currentTool === 'select'
    ) {
      const deltaX = world.x - moveStartRef.current.x
      const deltaY = world.y - moveStartRef.current.y

      // Update all selected shapes
      // This is where the magic happens - we move all selected shapes together
      Object.keys(initialShapePositionsRef.current).forEach((id) => {
        const initialPos = initialShapePositionsRef.current[id]
        const shape = entityState.entities[id]
        if (shape && initialPos) {
          if (
            shape.type === 'frame' ||
            shape.type === 'rect' ||
            shape.type === 'ellipse' ||
            shape.type === 'text' ||
            shape.type === 'generatedui'
          ) {
            if (
              typeof initialPos.x === 'number' &&
              typeof initialPos.y === 'number'
            ) {
              dispatch(
                updateShape({
                  id,
                  patch: {
                    x: initialPos.x + deltaX,
                    y: initialPos.y + deltaY,
                  },
                })
              )
            }
          } else if (shape.type === 'freedraw') {
            // For freehand, move all points by the delta
            const initialPoints = initialPos.points
            if (initialPoints) {
              const newPoints = initialPoints.map((point) => ({
                x: point.x + deltaX,
                y: point.y + deltaY,
              }))
              dispatch(
                updateShape({
                  id,
                  patch: {
                    points: newPoints,
                  },
                })
              )
            }
          } else if (shape.type === 'arrow' || shape.type === 'line') {
            // For arrows and lines, move both start and end points
            if (
              typeof initialPos.startX === 'number' &&
              typeof initialPos.startY === 'number' &&
              typeof initialPos.endX === 'number' &&
              typeof initialPos.endY === 'number'
            ) {
              dispatch(
                updateShape({
                  id,
                  patch: {
                    startX: initialPos.startX + deltaX,
                    startY: initialPos.startY + deltaY,
                    endX: initialPos.endX + deltaX,
                    endY: initialPos.endY + deltaY,
                  },
                })
              )
            }
          }
        }
      })
    }

    // Draw
    if (isDrawingRef.current) {
      if (draftShapeRef.current) {
        draftShapeRef.current.currentWorld = world
        requestRender()
      } else if (currentTool === 'freedraw') {
        freeDrawPointsRef.current.push(world)
        // rAF loop will render
      }
    }
  }

  // 🎯 SECTION 9: FINALIZE DRAWING - Convert draft shapes to real shapes
  // This is where we "commit" the drawing and add it to Redux

  // ✏️ FINALIZE DRAWING IF ANY - Convert draft shapes to real shapes
  // This is where we "commit" the drawing and add it to Redux
  const finalizeDrawingIfAny = (): void => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    if (freehandRafRef.current) {
      window.cancelAnimationFrame(freehandRafRef.current)
      freehandRafRef.current = null
    }

    const draft = draftShapeRef.current
    if (draft) {
      const x = Math.min(draft.startWorld.x, draft.currentWorld.x)
      const y = Math.min(draft.startWorld.y, draft.currentWorld.y)
      const w = Math.abs(draft.currentWorld.x - draft.startWorld.x)
      const h = Math.abs(draft.currentWorld.y - draft.startWorld.y)
      if (w > 1 && h > 1) {
        if (draft.type === 'frame') {
          console.log('Adding frame shape:', { x, y, w, h })
          dispatch(addFrame({ x, y, w, h }))
        } else if (draft.type === 'rect') {
          dispatch(addRect({ x, y, w, h }))
        } else if (draft.type === 'ellipse') {
          dispatch(addEllipse({ x, y, w, h }))
        } else if (draft.type === 'arrow') {
          dispatch(
            addArrow({
              startX: draft.startWorld.x,
              startY: draft.startWorld.y,
              endX: draft.currentWorld.x,
              endY: draft.currentWorld.y,
            })
          )
        } else if (draft.type === 'line') {
          dispatch(
            addLine({
              startX: draft.startWorld.x,
              startY: draft.startWorld.y,
              endX: draft.currentWorld.x,
              endY: draft.currentWorld.y,
            })
          )
        }
      }
      draftShapeRef.current = null
    } else if (currentTool === 'freedraw') {
      const pts = freeDrawPointsRef.current
      if (pts.length > 1) dispatch(addFreeDrawShape({ points: pts }))
      freeDrawPointsRef.current = []
    }

    requestRender()
  }

  // 🎯 SECTION 10: POINTER UP - Handle mouse/touch release
  // This finalizes all interactions and cleans up

  // 👆 ON POINTER UP - Handle mouse/touch release
  // This finalizes all interactions and cleans up
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId)

    if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
      dispatch(panEnd())
    }

    // Finalize movement
    if (isMovingRef.current) {
      isMovingRef.current = false
      moveStartRef.current = null
      initialShapePositionsRef.current = {}
    }

    // Finalize erasing
    if (isErasingRef.current) {
      isErasingRef.current = false
      erasedShapesRef.current.clear()
    }

    finalizeDrawingIfAny()
  }

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
    onPointerUp(e)
  }

  // 🎯 SECTION 11: KEYBOARD EVENTS - Handle keyboard shortcuts
  // This manages keyboard shortcuts like Shift for panning

  // ⌨️ ON KEY DOWN - Handle keyboard shortcuts
  // This manages keyboard shortcuts like Shift for panning
  const onKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      dispatch(selectAll())
      return
    }

    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      e.preventDefault()
      isSpacePressed.current = true // Keep the same ref name for consistency
      dispatch(handToolEnable())
    }
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault()
      isSpacePressed.current = false
      dispatch(handToolDisable())
    }
  }

  // 🎯 SECTION 12: EFFECTS - Set up event listeners and cleanup
  // This is where we attach event listeners and clean them up

  // 🎬 EFFECTS - Set up event listeners and cleanup
  // This is where we attach event listeners and clean them up
  useEffect((): (() => void) => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      if (freehandRafRef.current)
        window.cancelAnimationFrame(freehandRafRef.current)
      if (panRafRef.current) window.cancelAnimationFrame(panRafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 🎯 SECTION 13: RESIZE EVENTS - Handle shape resizing
  // This manages the complex shape resizing functionality that makes your tool feel professional
  //
  // WHY THIS EXISTS: Users expect to resize shapes by dragging corners, just like in Figma/Sketch
  // The challenge is that each corner behaves differently - some anchor the opposite corner,
  // others move the entire shape. This creates the intuitive resize experience users expect.
  //
  // THE MATH: When you drag a corner, we calculate which parts of the shape should move
  // and which should stay fixed, based on which corner is being dragged.

  // 📏 RESIZE EVENTS - Handle shape resizing
  // This manages the complex shape resizing functionality that makes your tool feel professional
  useEffect(() => {
    // 🎬 RESIZE START - Capture initial state when user starts dragging a corner
    // This is like pressing "record" - we capture everything we need to calculate the resize
    const handleResizeStart = (e: CustomEvent) => {
      const { shapeId, corner, bounds } = e.detail

      // Set the "we're resizing" flag so other interactions know to back off
      isResizingRef.current = true

      // Store all the data we need to calculate the resize
      // This is like taking a snapshot of the shape before the user starts dragging
      resizeDataRef.current = {
        shapeId, // Which shape is being resized
        corner, // Which corner (nw, ne, sw, se) is being dragged
        initialBounds: bounds, // The original size and position
        startPoint: { x: e.detail.clientX || 0, y: e.detail.clientY || 0 }, // Where the mouse started
      }
    }

    // 🎯 RESIZE MOVE - The heart of the resize logic
    // This is where the magic happens - we calculate new bounds based on which corner is dragged
    const handleResizeMove = (e: CustomEvent) => {
      // Safety check: only proceed if we're actually resizing and have the data
      if (!isResizingRef.current || !resizeDataRef.current) return

      const { shapeId, corner, initialBounds } = resizeDataRef.current
      const { clientX, clientY } = e.detail

      // 🌍 COORDINATE CONVERSION - Convert screen coordinates to world coordinates
      // This is crucial because the canvas can be zoomed and panned
      // The user's mouse position needs to be converted to the "world" coordinate system
      const canvasEl = canvasRef.current
      if (!canvasEl) return

      const rect = canvasEl.getBoundingClientRect()
      const localX = clientX - rect.left // Mouse position relative to canvas
      const localY = clientY - rect.top

      // Convert to world coordinates (accounts for zoom and pan)
      const world = screenToWorld(
        { x: localX, y: localY },
        viewport.translate,
        viewport.scale
      )

      // 🎯 SHAPE VALIDATION - Make sure the shape still exists
      const shape = entityState.entities[shapeId]
      if (!shape) return

      // 📐 BOUNDS CALCULATION - The core resize math
      // Each corner behaves differently - this is what makes resize feel intuitive
      const newBounds = { ...initialBounds }

      switch (corner) {
        case 'nw': // Northwest corner - user is dragging the top-left
          // When dragging top-left, the bottom-right corner stays fixed
          // Width = original width + how much we moved left
          newBounds.w = Math.max(
            10, // Minimum width to prevent disappearing shapes
            initialBounds.w + (initialBounds.x - world.x)
          )
          // Height = original height + how much we moved up
          newBounds.h = Math.max(
            10, // Minimum height
            initialBounds.h + (initialBounds.y - world.y)
          )
          // Position becomes the new corner position
          newBounds.x = world.x
          newBounds.y = world.y
          break

        case 'ne': // Northeast corner - user is dragging the top-right
          // When dragging top-right, the bottom-left corner stays fixed
          newBounds.w = Math.max(10, world.x - initialBounds.x)
          newBounds.h = Math.max(
            10,
            initialBounds.h + (initialBounds.y - world.y)
          )
          // X stays the same (left edge anchored), Y moves (top edge moves)
          newBounds.y = world.y
          break

        case 'sw': // Southwest corner - user is dragging the bottom-left
          // When dragging bottom-left, the top-right corner stays fixed
          newBounds.w = Math.max(
            10,
            initialBounds.w + (initialBounds.x - world.x)
          )
          newBounds.h = Math.max(10, world.y - initialBounds.y)
          // X moves (left edge moves), Y stays the same (top edge anchored)
          newBounds.x = world.x
          break

        case 'se': // Southeast corner - user is dragging the bottom-right
          // This is the "normal" resize - only width and height change
          // The top-left corner stays completely fixed
          newBounds.w = Math.max(10, world.x - initialBounds.x)
          newBounds.h = Math.max(10, world.y - initialBounds.y)
          break
      }

      // 🎨 SHAPE-SPECIFIC UPDATES - Different shapes need different handling
      // Simple shapes (frames, rectangles, ellipses) just update their bounds
      if (
        shape.type === 'frame' ||
        shape.type === 'rect' ||
        shape.type === 'ellipse'
      ) {
        dispatch(
          updateShape({
            id: shapeId,
            patch: {
              x: newBounds.x,
              y: newBounds.y,
              w: newBounds.w,
              h: newBounds.h,
            },
          })
        )
      } else if (shape.type === 'freedraw') {
        // 🖊️ FREEHAND DRAWINGS - More complex because we need to scale all the points
        // Freehand drawings are made up of many individual points that need to be scaled proportionally

        // Calculate the actual drawing bounds (without padding)
        const xs = shape.points.map((p: { x: number; y: number }) => p.x)
        const ys = shape.points.map((p: { x: number; y: number }) => p.y)
        const actualMinX = Math.min(...xs)
        const actualMaxX = Math.max(...xs)
        const actualMinY = Math.min(...ys)
        const actualMaxY = Math.max(...ys)
        const actualWidth = actualMaxX - actualMinX
        const actualHeight = actualMaxY - actualMinY

        // Calculate new actual bounds (removing padding)
        const newActualX = newBounds.x + 5 // Remove padding
        const newActualY = newBounds.y + 5
        const newActualWidth = Math.max(10, newBounds.w - 10) // Minimum size and remove padding
        const newActualHeight = Math.max(10, newBounds.h - 10)

        // Calculate scale factors based on actual dimensions
        const scaleX = actualWidth > 0 ? newActualWidth / actualWidth : 1
        const scaleY = actualHeight > 0 ? newActualHeight / actualHeight : 1

        // Scale all the points proportionally
        const scaledPoints = shape.points.map(
          (point: { x: number; y: number }) => ({
            x: newActualX + (point.x - actualMinX) * scaleX,
            y: newActualY + (point.y - actualMinY) * scaleY,
          })
        )

        dispatch(
          updateShape({
            id: shapeId,
            patch: {
              points: scaledPoints,
            },
          })
        )
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        // 📏 LINES AND ARROWS - Handle start/end points instead of bounds
        // Lines are defined by start and end points, not width/height
        // We need to map the new bounds back to start/end coordinates

        // Calculate actual bounds (without padding)
        const actualMinX = Math.min(shape.startX, shape.endX)
        const actualMaxX = Math.max(shape.startX, shape.endX)
        const actualMinY = Math.min(shape.startY, shape.endY)
        const actualMaxY = Math.max(shape.startY, shape.endY)
        const actualWidth = actualMaxX - actualMinX
        const actualHeight = actualMaxY - actualMinY

        // Calculate new actual bounds (removing padding)
        const newActualX = newBounds.x + 5
        const newActualY = newBounds.y + 5
        const newActualWidth = Math.max(10, newBounds.w - 10)
        const newActualHeight = Math.max(10, newBounds.h - 10)

        // Map the start and end points to new bounds
        let newStartX, newStartY, newEndX, newEndY

        if (actualWidth === 0) {
          // 📏 VERTICAL LINE - Only height changes, width stays centered
          newStartX = newActualX + newActualWidth / 2
          newEndX = newActualX + newActualWidth / 2
          newStartY =
            shape.startY < shape.endY
              ? newActualY
              : newActualY + newActualHeight
          newEndY =
            shape.startY < shape.endY
              ? newActualY + newActualHeight
              : newActualY
        } else if (actualHeight === 0) {
          // 📏 HORIZONTAL LINE - Only width changes, height stays centered
          newStartY = newActualY + newActualHeight / 2
          newEndY = newActualY + newActualHeight / 2
          newStartX =
            shape.startX < shape.endX ? newActualX : newActualX + newActualWidth
          newEndX =
            shape.startX < shape.endX ? newActualX + newActualWidth : newActualX
        } else {
          // 📏 DIAGONAL LINE - Scale proportionally
          const scaleX = newActualWidth / actualWidth
          const scaleY = newActualHeight / actualHeight

          newStartX = newActualX + (shape.startX - actualMinX) * scaleX
          newStartY = newActualY + (shape.startY - actualMinY) * scaleY
          newEndX = newActualX + (shape.endX - actualMinX) * scaleX
          newEndY = newActualY + (shape.endY - actualMinY) * scaleY
        }

        dispatch(
          updateShape({
            id: shapeId,
            patch: {
              startX: newStartX,
              startY: newStartY,
              endX: newEndX,
              endY: newEndY,
            },
          })
        )
      }
    }

    // 🏁 RESIZE END - Clean up when user stops dragging
    // This resets the resize state so other interactions can work normally
    const handleResizeEnd = () => {
      isResizingRef.current = false
      resizeDataRef.current = null
    }

    // 🎧 EVENT LISTENERS - Listen for resize events from the shape components
    // These events are fired by the shape components when users interact with resize handles
    window.addEventListener(
      'shape-resize-start',
      handleResizeStart as EventListener
    )
    window.addEventListener(
      'shape-resize-move',
      handleResizeMove as EventListener
    )
    window.addEventListener(
      'shape-resize-end',
      handleResizeEnd as EventListener
    )

    // 🧹 CLEANUP - Remove event listeners when component unmounts
    return () => {
      window.removeEventListener(
        'shape-resize-start',
        handleResizeStart as EventListener
      )
      window.removeEventListener(
        'shape-resize-move',
        handleResizeMove as EventListener
      )
      window.removeEventListener(
        'shape-resize-end',
        handleResizeEnd as EventListener
      )
    }
  }, [dispatch, entityState.entities, viewport.translate, viewport.scale])

  // 🎯 SECTION 14: CANVAS REF ATTACHMENT - Connect to DOM element
  // This connects our hook to the actual canvas DOM element so we can listen for events
  //
  // WHY THIS EXISTS: The hook needs to attach event listeners to the actual canvas DOM element
  // This is the bridge between our React hook and the real DOM element that users interact with

  // 🖼️ ATTACH CANVAS REF - Connect to DOM element
  // This connects our hook to the actual canvas DOM element so we can listen for events
  const attachCanvasRef = (ref: HTMLDivElement | null): void => {
    // Clean up any existing event listeners on the old canvas
    if (canvasRef.current) {
      canvasRef.current.removeEventListener('wheel', onWheel)
    }

    // Store the new canvas reference
    canvasRef.current = ref

    // Add wheel event listener to the new canvas (for zoom/pan)
    if (ref) {
      ref.addEventListener('wheel', onWheel, { passive: false })
    }
  }

  // 🎯 SECTION 15: TOOL CONTROL - Manage drawing tools
  // This provides a simple way to change tools from components
  //
  // WHY THIS EXISTS: Components need a way to switch between different drawing tools
  // This is the public API for tool management

  // 🛠️ TOOL CONTROL - Manage drawing tools
  // This provides a simple way to change tools from components
  const selectTool = (tool: Tool): void => {
    dispatch(setTool(tool))
  }

  const selectAllShapes = (): void => {
    dispatch(setTool('select')) // Auto switch to select tool
    dispatch(selectAll())
  }

  // 🎯 SECTION 16: DRAFT ACCESSORS - Get draft shape data
  // These provide access to draft shapes for rendering
  //
  // WHY THIS EXISTS: Components need access to temporary/draft shapes that aren't in Redux yet
  // These are shapes that are being drawn but not yet committed

  // ✏️ DRAFT ACCESSORS - Get draft shape data
  // These provide access to draft shapes for rendering
  const getDraftShape = (): DraftShape | null => draftShapeRef.current
  const getFreeDrawPoints = (): ReadonlyArray<Point> =>
    freeDrawPointsRef.current

  // 🎯 SECTION 17: RETURN OBJECT - What the hook provides
  // This is what components get when they use this hook
  //
  // WHY THIS EXISTS: This is the public API of the hook - everything components need
  // to interact with the canvas system

  // 🎁 RETURN OBJECT - What the hook provides
  // This is what components get when they use this hook
  return {
    // 📊 STATE - Current state of the canvas system
    viewport, // Current zoom, pan, and viewport state
    shapes: shapeList, // All shapes on the canvas (safe to .map)
    currentTool, // Currently selected drawing tool
    selectedShapes, // Currently selected shapes

    // 🖱️ POINTER HANDLERS - Event handlers for user interactions
    onPointerDown, // Handle mouse/touch down events
    onPointerMove, // Handle mouse/touch move events
    onPointerUp, // Handle mouse/touch up events
    onPointerCancel, // Handle cancelled pointer events

    // 🔧 HELPERS - Utility functions for components
    attachCanvasRef, // Connect the hook to a DOM element
    selectTool, // Change the current drawing tool
    getDraftShape, // Get current draft shape (if any)
    getFreeDrawPoints, // Get current freehand drawing points
    isSidebarOpen, // Whether the sidebar is open
    hasSelectedText, // Whether a text shape is selected
    setIsSidebarOpen, // Control sidebar visibility
    selectAllShapes, // Function to select all shapes
  }
}

// 🧠 HOW EVERYTHING CONNECTS TOGETHER
// This hook is the **central nervous system** of your drawing app. Here's how all the pieces work together:
// 1. **Redux Connection**: The hook connects to Redux to get all the app's state (shapes, viewport, tools)
// 2. **Event Handling**: It listens for all user interactions (mouse, touch, keyboard) and decides what to do
// 3. **State Management**: It uses refs to track temporary state (draft shapes, movement data) that doesn't need to be in Redux
// 4. **Shape Operations**: It handles creating, selecting, moving, resizing, and deleting shapes
// 5. **Performance**: It uses requestAnimationFrame for smooth animations and prevents unnecessary re-renders
// 6. **Tool System**: It manages different drawing tools and their specific behaviors
// 7. **Coordinate System**: It handles the complex math of converting between screen coordinates and world coordinates
// The hook essentially **orchestrates** all the complex interactions needed for a professional drawing application, making it easy for components to just use the simple API it provides!

// 🎯 FRAME GENERATION HOOK - Generate UI designs from frame wireframes
// This hook handles the AI-powered generation of UI designs from frame wireframes
//
// WHY THIS EXISTS: Users create wireframes with frames, then want to generate actual UI designs
// This hook takes a frame (wireframe) and sends it to AI to generate a real UI design
//
// THE FLOW: Frame → Snapshot → AI API → Generated UI Shape

export const useFrame = (shape: FrameShape) => {
  const dispatch = useAppDispatch()
  const [isGenerating, setIsGenerating] = useState(false)

  // Get all shapes to include in the frame snapshot
  const allShapes = useAppSelector((state) =>
    Object.values(state.shapes.present.shapes?.entities || {}).filter(
      (shape): shape is Shape => shape !== undefined
    )
  )

  // 🎨 GENERATE DESIGN - The main function that converts frame to UI design
  const handleGenerateDesign = async () => {
    // 🆔 CREATE GENERATED UI SHAPE IMMEDIATELY so user sees feedback right away
    const generatedUIId = nanoid()
    const generatedUIPosition = {
      x: shape.x + shape.w + 50,
      y: shape.y,
      w: Math.max(400, shape.w),
      h: Math.max(300, shape.h),
    }
    dispatch(
      addGeneratedUI({
        ...generatedUIPosition,
        id: generatedUIId,
        uiSpecData: null,
        sourceFrameId: shape.id,
        generationStage: 'capturing',
        generationProgress: 5,
      })
    )

    try {
      setIsGenerating(true)

      // 📸 STAGE 1: CAPTURE FRAME SNAPSHOT
      const snapshot = await generateFrameSnapshot(shape, allShapes)
      dispatch(updateShape({ id: generatedUIId, patch: { generationStage: 'uploading', generationProgress: 20 } }))

      // 📤 STAGE 2: PREPARE & SEND API REQUEST
      const formData = new FormData()
      formData.append('image', snapshot, `frame-${shape.frameNumber}.png`)
      formData.append('frameNumber', shape.frameNumber.toString())

      const urlParams = new URLSearchParams(window.location.search)
      const projectId = urlParams.get('project')
      if (projectId) formData.append('projectId', projectId)

      // 📝 Build text description of shapes for AI context (works even with rough sketches)
      const shapeDescription = buildShapeDescription(allShapes, shape)
      formData.append('shapeDescription', shapeDescription)
      console.log('[generate] Shape description:', shapeDescription)

      dispatch(updateShape({ id: generatedUIId, patch: { generationStage: 'analyzing', generationProgress: 35 } }))

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      // 📡 STAGE 3: STREAM RESPONSE
      dispatch(updateShape({ id: generatedUIId, patch: { generationStage: 'streaming', generationProgress: 50, streamedBytes: 0 } }))

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedMarkup = ''
      let lastUpdateTime = 0
      const UPDATE_THROTTLE_MS = 150
      let totalBytesReceived = 0

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              // Check if we actually got content
              const trimmed = accumulatedMarkup.trim()
              if (trimmed.length < 50) {
                // AI returned nothing useful
                dispatch(
                  updateShape({
                    id: generatedUIId,
                    patch: {
                      generationStage: 'error',
                      generationProgress: 0,
                      errorMessage:
                        'The AI returned an empty response. This can happen if your sketch is very faint or all-black. Try adding more shapes and labels to your wireframe, then generate again.',
                    },
                  })
                )
                toast.error('Generation produced no output — please add more detail to your sketch and try again.')
              } else {
                // ✅ STAGE 4: DONE
                dispatch(
                  updateShape({
                    id: generatedUIId,
                    patch: {
                      uiSpecData: accumulatedMarkup,
                      generationStage: 'done',
                      generationProgress: 100,
                      streamedBytes: totalBytesReceived,
                    },
                  })
                )
                toast.success('Design generated! ✨')
              }
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            accumulatedMarkup += chunk
            totalBytesReceived += value?.byteLength ?? chunk.length

            // Calculate streaming progress: 50% -> 95% while streaming
            const streamProgress = Math.min(95, 50 + Math.floor((totalBytesReceived / 8000) * 45))

            const now = Date.now()
            if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
              dispatch(
                updateShape({
                  id: generatedUIId,
                  patch: {
                    uiSpecData: accumulatedMarkup,
                    generationProgress: streamProgress,
                    streamedBytes: totalBytesReceived,
                  },
                })
              )
              lastUpdateTime = now
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      dispatch(
        updateShape({
          id: generatedUIId,
          patch: {
            generationStage: 'error',
            generationProgress: 0,
            errorMessage: errMsg,
          },
        })
      )
      toast.error(`Generation failed: ${errMsg}`)
    } finally {
      setIsGenerating(false)
    }
  }

  // 💾 DOWNLOAD DESIGN - Separate function to save the frame design to desktop
  const handleDownloadDesign = async () => {
    try {
      const snapshot = await generateFrameSnapshot(shape, allShapes)
      downloadBlob(snapshot, `frame-${shape.frameNumber}-snapshot.png`)
      toast.success('Design saved to desktop')
    } catch (error) {
      toast.error('Failed to save design')
    }
  }

  return {
    isGenerating,
    handleGenerateDesign,
    handleDownloadDesign,
  }
}

// 🎯 WORKFLOW GENERATION HOOK - Generate multiple workflow pages from a main design
// This hook takes a generated UI design and creates 4 additional workflow pages
//
// WHY THIS EXISTS: Users want to see how their design works across different pages
// This creates a complete user flow: main page + 4 workflow pages (like login, dashboard, etc.)
//
// THE FLOW: Generated UI → AI generates 4 workflow pages → All positioned side by side

export const useWorkflowGeneration = () => {
  const dispatch = useAppDispatch()
  const [, { isLoading: isGeneratingWorkflow }] = useGenerateWorkflowMutation()

  // Get all shapes to work with
  const allShapes = useAppSelector((state) =>
    Object.values(state.shapes.present.shapes?.entities || {}).filter(
      (shape): shape is Shape => shape !== undefined
    )
  )

  // 🔄 GENERATE WORKFLOW - Create 4 workflow pages from a main design
  const generateWorkflow = async (generatedUIId: string) => {
    try {
      // 🎯 VALIDATE INPUT - Make sure we have a valid generated UI to work with
      const currentShape = allShapes.find((shape) => shape.id === generatedUIId)
      if (!currentShape || currentShape.type !== 'generatedui') {
        toast.error('Generated UI not found')
        return
      }

      if (!currentShape.uiSpecData) {
        toast.error('No design data to generate workflow from')
        return
      }

      // 🔗 GET PROJECT CONTEXT - Include project ID for AI context
      const urlParams = new URLSearchParams(window.location.search)
      const projectId = urlParams.get('project')

      if (!projectId) {
        toast.error('Project ID not found')
        return
      }

      // 📊 DEFINE WORKFLOW PAGES - Generate 4 different workflow pages
      const pageCount = 4

      toast.loading('Generating workflow pages...', {
        id: 'workflow-generation',
      })

      // 📍 CALCULATE POSITIONS - Arrange workflow pages side by side
      const baseX = currentShape.x + currentShape.w + 100 // 100px gap from main design
      const spacing = Math.max(currentShape.w + 50, 450) // At least 450px or current width + 50px spacing

      // 🚀 GENERATE ALL PAGES - Create all 4 workflow pages in parallel
      const workflowPromises = Array.from({ length: pageCount }).map(
        async (_, index) => {
          try {
            // Send request to AI for this specific workflow page
            const response = await fetch('/api/generate/workflow', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                generatedUIId,
                currentHTML: currentShape.uiSpecData,
                projectId,
                pageIndex: index,
              }),
            })

            if (!response.ok) {
              throw new Error(
                `Failed to generate page ${index + 1}: ${response.status}`
              )
            }

            // 📍 POSITION THIS PAGE - Calculate where this workflow page should go
            const workflowPosition = {
              x: baseX + index * spacing,
              y: currentShape.y,
              w: Math.max(400, currentShape.w), // At least 400px wide
              h: Math.max(300, currentShape.h), // At least 300px high
            }

            // 🆔 CREATE WORKFLOW PAGE SHAPE - Add the new shape to canvas immediately
            const workflowId = nanoid()

            // Create the workflow UI shape immediately
            dispatch(
              addGeneratedUI({
                ...workflowPosition,
                id: workflowId,
                uiSpecData: null, // Start with null for live rendering
                sourceFrameId: currentShape.sourceFrameId,
                isWorkflowPage: true, // Mark as workflow page
              })
            )

            // 📡 STREAM RESPONSE - Handle the AI's streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulatedHTML = ''

            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                accumulatedHTML += chunk

                // Update the workflow page with streamed HTML
                dispatch(
                  updateShape({
                    id: workflowId,
                    patch: { uiSpecData: accumulatedHTML },
                  })
                )
              }
            }

            return { pageIndex: index, success: true }
          } catch (error) {
            console.error(`Error generating page ${index + 1}:`, error)
            return { pageIndex: index, success: false, error }
          }
        }
      )

      // ⏳ WAIT FOR COMPLETION - Wait for all workflow pages to finish generating
      const results = await Promise.all(workflowPromises)

      // 📊 SHOW RESULTS - Display success/failure messages to user
      const successCount = results.filter((r) => r.success).length
      const failureCount = results.length - successCount

      if (successCount === 4) {
        toast.success('✨ All 4 workflow pages generated successfully!', {
          id: 'workflow-generation',
        })
      } else if (successCount > 0) {
        toast.success(
          `✨ Generated ${successCount}/4 workflow pages successfully!`,
          { id: 'workflow-generation' }
        )
        if (failureCount > 0) {
          toast.error(`Failed to generate ${failureCount} workflow pages`)
        }
      } else {
        toast.error('Failed to generate workflow pages', {
          id: 'workflow-generation',
        })
      }
    } catch (error) {
      console.error('Workflow generation error:', error)
      toast.error('Failed to generate workflow pages', {
        id: 'workflow-generation',
      })
    }
  }

  return {
    generateWorkflow,
    isGeneratingWorkflow,
  }
}

// 🎯 GLOBAL CHAT HOOK - Manage chat interactions with generated UI designs
// This hook handles the chat interface that allows users to modify generated designs
//
// WHY THIS EXISTS: Users want to iterate on their generated designs through conversation
// This provides a chat interface where users can ask for changes and see them applied in real-time
//
// THE FLOW: User opens chat → Types request → AI modifies design → User sees changes

export const useGlobalChat = () => {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeGeneratedUIId, setActiveGeneratedUIId] = useState<string | null>(
    null
  )

  const { generateWorkflow } = useWorkflowGeneration()

  // 📤 EXPORT DESIGN - Save generated UI as PNG image
  const exportDesign = async (
    generatedUIId: string,
    element: HTMLElement | null
  ) => {
    console.log('🔍 Export Debug Info:', {
      generatedUIId,
      elementExists: !!element,
      elementTag: element?.tagName,
    })

    if (!element) {
      console.warn('❌ No element to export for shape:', generatedUIId)
      toast.error('No design element found for export.')
      return
    }

    try {
      const filename = `generated-ui-${generatedUIId.slice(0, 8)}.png`
      console.log('📤 Starting snapshot export:', { filename })

      await exportGeneratedUIAsPNG(element, filename)

      toast.success('Design exported successfully!')
    } catch (error) {
      console.error('❌ Failed to export GeneratedUI:', error)
      toast.error('Failed to export design. Please try again.')
    }
  }

  // 💬 CHAT CONTROLS - Manage chat window state
  const openChat = (generatedUIId: string) => {
    setActiveGeneratedUIId(generatedUIId)
    setIsChatOpen(true)
  }

  const closeChat = () => {
    setIsChatOpen(false)
    setActiveGeneratedUIId(null)
  }

  const toggleChat = (generatedUIId: string) => {
    if (isChatOpen && activeGeneratedUIId === generatedUIId) {
      closeChat()
    } else {
      openChat(generatedUIId)
    }
  }

  return {
    isChatOpen,
    activeGeneratedUIId,
    openChat,
    closeChat,
    toggleChat,
    generateWorkflow,
    exportDesign,
  }
}

// 🎯 UI SELECTION HOOK - Handle element selection within generated UI designs
// This hook allows users to click on elements within generated UI designs to select them
//
// WHY THIS EXISTS: Users need to be able to select specific elements within generated designs
// This provides visual feedback and enables element-specific interactions
//
// THE FLOW: User clicks element → Element gets highlighted → Element ID is tracked

export const useUiSelection = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    console.log(container)
    if (!container) return

    // 🖱️ CLICK HANDLER - Handle clicks on elements within the generated UI
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // find nearest element with an id inside the container
      const elWithId = target.closest<HTMLElement>('[id]')
      if (elWithId && container.contains(elWithId)) {
        // remove highlight from previously selected element
        if (selectedId) {
          const prev = container.querySelector<HTMLElement>(`#${selectedId}`)
          prev?.classList.remove('outline', 'outline-2', 'outline-blue-500')
        }

        // add highlight to the clicked element
        elWithId.classList.add('outline', 'outline-2', 'outline-blue-500')
        setSelectedId(elWithId.id)
      }
    }

    container.addEventListener('click', handleClick)
    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [selectedId])

  console.log(selectedId)

  return { containerRef, selectedId }
}

// 🎯 CHAT WINDOW HOOK - Handle chat interactions for a specific generated UI design
// This hook manages the chat interface that allows users to modify a specific generated design
//
// WHY THIS EXISTS: Users need a way to iterate on their generated designs through conversation
// This provides the chat interface, message handling, and real-time design updates
//
// THE FLOW: User types message → AI processes request → Design updates in real-time → Chat shows response

export const useChatWindow = (generatedUIId: string, isOpen: boolean) => {
  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dispatch = useAppDispatch()

  // 📊 GET CHAT STATE - Get chat state for this specific GeneratedUI
  const chatState = useAppSelector((state) => state.chat.chats[generatedUIId])
  const currentShape = useAppSelector(
    (state) => state.shapes.shapes.entities[generatedUIId]
  )
  const allShapes = useAppSelector((state) => state.shapes.shapes.entities)

  // 🎯 GET SOURCE FRAME - Find the original frame that this GeneratedUI was created from
  // This is needed for main page redesigns to include wireframe context
  const getSourceFrame = (): FrameShape | null => {
    if (!currentShape || currentShape.type !== 'generatedui') {
      return null
    }

    const sourceFrameId = currentShape.sourceFrameId
    if (!sourceFrameId) {
      return null
    }

    const sourceFrame = allShapes[sourceFrameId]
    if (!sourceFrame || sourceFrame.type !== 'frame') {
      return null
    }

    return sourceFrame as FrameShape
  }

  // 🚀 INITIALIZE CHAT - Set up chat when window opens
  useEffect(() => {
    if (isOpen) {
      dispatch(initializeChat(generatedUIId))
    }
  }, [dispatch, generatedUIId, isOpen])

  // 📜 AUTO-SCROLL - Keep chat scrolled to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [chatState?.messages])

  // 🎯 FOCUS INPUT - Focus the input field when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // 💬 SEND MESSAGE - Handle sending messages and regenerating designs
  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatState?.isStreaming) return

    const message = inputValue.trim()
    setInputValue('')

    try {
      // Add user message to chat
      dispatch(addUserMessage({ generatedUIId, content: message }))

      // Start streaming response
      const responseId = `response-${Date.now()}`
      dispatch(startStreamingResponse({ generatedUIId, messageId: responseId }))

      // Check if this is a workflow page
      const isWorkflowPage =
        currentShape?.type === 'generatedui' && currentShape.isWorkflowPage

      // Debug logging
      console.log('🔍 Chat Debug - Shape type:', currentShape?.type)
      console.log('🔍 Chat Debug - Is workflow page:', isWorkflowPage)
      console.log(
        '🔍 Chat Debug - Current HTML length:',
        currentShape?.type === 'generatedui'
          ? currentShape.uiSpecData?.length
          : 'N/A'
      )
      console.log(
        '🔍 Chat Debug - HTML preview:',
        currentShape?.type === 'generatedui'
          ? currentShape.uiSpecData?.substring(0, 100)
          : 'N/A'
      )

      // Get current project ID from URL
      const urlParams = new URLSearchParams(window.location.search)
      const projectId = urlParams.get('project')

      if (!projectId) {
        throw new Error('Project ID not found in URL')
      }

      const baseRequestData = {
        userMessage: message,
        generatedUIId: generatedUIId,
        currentHTML:
          currentShape?.type === 'generatedui' ? currentShape.uiSpecData : null,
        projectId: projectId, // Pass projectId in body
      }

      let apiEndpoint = '/api/generate/redesign' // Default to main page redesign

      let wireframeSnapshot: string | null = null

      if (isWorkflowPage) {
        // For workflow pages: use workflow-specific endpoint, no wireframe needed
        console.log('🔄 Workflow page redesign - using inspiration images only')
        apiEndpoint = '/api/generate/workflow-redesign'
      } else {
        // For main pages: include wireframe snapshot
        const sourceFrame = getSourceFrame()
        if (sourceFrame && sourceFrame.type === 'frame') {
          try {
            const allShapesArray = Object.values(allShapes).filter(
              Boolean
            ) as Shape[]
            const snapshot = await generateFrameSnapshot(
              sourceFrame,
              allShapesArray
            )

            // Convert blob to base64 for transmission (same format as original generation)
            const arrayBuffer = await snapshot.arrayBuffer()
            const base64 = btoa(
              String.fromCharCode(...new Uint8Array(arrayBuffer))
            )
            wireframeSnapshot = base64 // Send raw base64, not data URI
          } catch (error) {
            console.warn(
              '⚠️ Failed to capture source wireframe snapshot:',
              error
            )
            // Continue without snapshot
          }
        } else {
          console.warn('⚠️ No source frame available for wireframe snapshot')
        }
      }

      // Prepare final request data based on page type
      const requestData = isWorkflowPage
        ? baseRequestData
        : { ...baseRequestData, wireframeSnapshot }

      // Use fetch for streaming since RTK Query doesn't handle it well
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedHTML = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          accumulatedHTML += chunk

          // Update streaming message with "Regenerating design..."
          dispatch(
            updateStreamingContent({
              generatedUIId,
              messageId: responseId,
              content: 'Regenerating your design...',
            })
          )

          // Update the GeneratedUI shape with new HTML in real-time
          dispatch(
            updateShape({
              id: generatedUIId,
              patch: { uiSpecData: accumulatedHTML },
            })
          )
        }
      }

      // Finish streaming
      dispatch(
        finishStreamingResponse({
          generatedUIId,
          messageId: responseId,
          finalContent: '✨ Design regenerated successfully!',
        })
      )
    } catch (error) {
      console.error('Chat error:', error)
      dispatch(
        addErrorMessage({
          generatedUIId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      )
      toast.error('Failed to regenerate design')
    }
  }

  // ⌨️ KEYBOARD HANDLING - Handle Enter key to send messages
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 🗑️ CLEAR CHAT - Clear the chat history
  const handleClearChat = () => {
    dispatch(clearChat(generatedUIId))
  }

  return {
    inputValue,
    setInputValue,
    scrollAreaRef,
    inputRef,
    handleSendMessage,
    handleKeyPress,
    handleClearChat,
    chatState,
  }
}
