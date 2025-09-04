import React, { createContext, useContext, useCallback, useRef, useState, useEffect, ReactNode, Ref, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useFloating, autoUpdate, offset, useTransitionStatus } from "@floating-ui/react";
import { motion, useSpring } from "framer-motion";

type FollowTarget = HTMLElement | null;
type AltTarget = { x: number, y: number };
type FollowerContent = ReactNode | null;

// State types for follower data that can be managed via setFollowerState
type FollowerState = {
  inertialMode?: boolean;
  springConfig?: { stiffness?: number; damping?: number; mass?: number };
};

// Updater function type for setFollowerState
type FollowerStateUpdater = (prevState: FollowerState) => FollowerState;

// Context that lets any Target register itself as a reference
type SetRef = (id: string, el: HTMLElement | null) => void;
type SubscribeToTarget = (id: string, callback: (target: FollowTarget | null) => void) => () => void;
type SubscribeToAltTarget = (id: string, callback: (altTarget: AltTarget | undefined) => void) => () => void;
type SubscribeToFollowerState = (id: string, callback: (state: FollowerState) => void) => () => void;
type SubscribeToFollowerContent = (id: string, callback: (content: FollowerContent) => void) => () => void;

// setFollowerState function type - accepts object or updater function
type SetFollowerState = (id: string, stateOrUpdater: FollowerState | FollowerStateUpdater) => void;

type FollowerCtxType = {
  setTargetReference: SetRef;
  subscribeToTarget: SubscribeToTarget;
  subscribeToAltTarget: (id: string, callback: (altTarget: AltTarget | undefined) => void) => () => void;
  setFollowerContent: (id: string, content: ReactNode | null) => void;
  getFollowerContent: (id: string) => ReactNode | null;
  setAltTarget: (id: string, altTarget: AltTarget | undefined) => void;
  getAltTarget: (id: string) => AltTarget | undefined;
  setFollowerState: SetFollowerState;
  getFollowerState: (id: string) => FollowerState;
  subscribeFollowerState: SubscribeToFollowerState;
  subscribeToFollowerContent: SubscribeToFollowerContent;
  cleanupFollower: (id: string) => void;
}

const FollowerCtx = createContext<FollowerCtxType | null>(null);

const useFollowerContent = (id: string, subscribeToFollowerContent: SubscribeToFollowerContent) => {
  // Subscribe to content changes
  const [content, setContent] = useState<FollowerContent>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFollowerContent(id, (newContent) => {
      setContent(newContent);
    });
    return unsubscribe;
  }, [id, subscribeToFollowerContent]);

  return content;
}

// Hook for subscribing to follower state changes
export const useFollowerState = (id: string) => {
  const context = useContext(FollowerCtx);
  if (!context) throw new Error("Wrap your app with <FollowerProvider/>");
  const { getFollowerState, subscribeFollowerState } = context;

  const [state, setState] = useState<FollowerState>(() => getFollowerState(id));

  useEffect(() => {
    const unsubscribe = subscribeFollowerState(id, (newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, [id, subscribeFollowerState]);

  return state;
};

// Internal hook for managing the follower state
const useFollowerStateInternal = (id: string, subscribeToTarget: SubscribeToTarget, subscribeToAltTarget: SubscribeToAltTarget) => {
  const followerContext = useContext(FollowerCtx);
  if (!followerContext) throw new Error("Wrap your app with <FollowerProvider/>");
  const { getFollowerState } = followerContext;

  const followerState = getFollowerState(id);
  const useInertial = followerState.inertialMode || false;
  const isInitiallyPositioned = useRef(false);
  const [followEntry, setFollowEntry] = useState<FollowTarget | null>(null);
  const [altTarget, setAltTarget] = useState<AltTarget | undefined>(undefined);
  const shouldBeVisible = !!followEntry || !!altTarget;
  const shouldAnimate = shouldBeVisible && isInitiallyPositioned.current;

  // Subscribe to target changes
  useEffect(() => {
    const unsubscribe = subscribeToTarget(id, (target) => {
      setFollowEntry(target);
    });
    return unsubscribe;
  }, [id, subscribeToTarget]);

  // Subscribe to altTarget changes
  useEffect(() => {
    const unsubscribe = subscribeToAltTarget(id, (altTarget) => {
      setAltTarget(altTarget);
    });
    return unsubscribe;
  }, [id, subscribeToAltTarget]);

  // Configure floating-ui system
  const { refs, floatingStyles, context, x, y } = useFloating({
    open: shouldBeVisible,
    strategy: "fixed",
    placement: "bottom-start",
    whileElementsMounted: (reference, floating, update) => {
      return autoUpdate(reference, floating, update, {
        // Disable sometimes problematic element resize subscriber
        elementResize: false,
      });
    },
    middleware: [
      // Adjust position
      offset(({ rects }) => ({ mainAxis: -rects.reference.height })),
    ],
  });
  const { status } = useTransitionStatus(context);
  const isOpen = status === "open";

  // After the first open, mark as initially positioned
  useEffect(() => {
    if (isInitiallyPositioned.current) return;
    if (isOpen) {
      isInitiallyPositioned.current = true;
    }
  }, [isOpen]);

  // If altTarget is set, set a virtual element as the position reference
  useEffect(() => {
    if (altTarget) {
      const virtualEl = {
        getBoundingClientRect() {
          return {
            x: 0,
            y: 0,
            top: altTarget.y,
            left: altTarget.x,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
          };
        },
      };
      refs.setPositionReference(virtualEl);
      return () => refs.setPositionReference(null);
    } else {
      const targetElement = followEntry || null;
      refs.setReference(targetElement);
    }
  }, [altTarget, followEntry, refs]);

  // Get the current target element and update the reference
  // TODO: This is likely unnecessary indirection and the reference could be set directly.
  useEffect(() => {
    if (followEntry) {
      refs.setReference(followEntry);
    }
  }, [refs, followEntry]);

  return { refs, floatingStyles, x, y, shouldAnimate, useInertial, shouldBeVisible, getSpringConfig: () => followerState.springConfig || {} };
}

interface SpringFollowerProps {
  id: string;
  floatingX: number;
  floatingY: number;
  children: ReactNode;
  springConfig: { stiffness?: number; damping?: number; mass?: number };
  floatingRef: (node: HTMLElement | null) => void;
  floatingStyles: CSSProperties;
}
// Internal component that follows a target element with inertial springs
const SpringFollower = ({ id, floatingX, floatingY, children, springConfig, floatingRef, floatingStyles }: SpringFollowerProps) => {
  // Inertial springs for smooth movement
  const stiffness = springConfig.stiffness ?? 400;
  const damping = springConfig.damping ?? 40;
  const mass = springConfig.mass ?? 1;
  const springX = useSpring(floatingX, { stiffness, damping, mass });
  const springY = useSpring(floatingY, { stiffness, damping, mass });

  // Update spring targets when Floating UI position changes
  useEffect(() => {
    if (typeof floatingX === "number") springX.set(floatingX);
    if (typeof floatingY === "number") springY.set(floatingY);
  }, [floatingX, floatingY, springX, springY]);

  return <motion.div
    key={id}
    ref={floatingRef}
    style={{
      ...floatingStyles,
      transform: "none",
      top: springY,
      left: springX,
      willChange: "top, left"
    }}>{children}</motion.div>;
}

interface FollowerProps {
  id: string;
  subscribeToTarget: SubscribeToTarget;
  subscribeToAltTarget: SubscribeToAltTarget;
  subscribeToFollowerContent: SubscribeToFollowerContent;
}
// Internal Follower component that follows a target element (or alternate target)
const Follower = ({ id, subscribeToTarget, subscribeToAltTarget, subscribeToFollowerContent }: FollowerProps) => {
  const followerContext = useContext(FollowerCtx);
  if (!followerContext) throw new Error("Wrap your app with <FollowerProvider/>");
  const { getFollowerState } = followerContext;

  // Subscribe to content changes
  const content = useFollowerContent(id, subscribeToFollowerContent);

  const { refs, floatingStyles, x, y, shouldAnimate, useInertial, shouldBeVisible } = useFollowerStateInternal(id, subscribeToTarget, subscribeToAltTarget);

  if (!shouldBeVisible) return null;

  if (useInertial) {
    const followerState = getFollowerState(id);
    const springConfig = followerState.springConfig || {};
    return <SpringFollower
      id={id}
      children={content}
      springConfig={springConfig}
      floatingRef={refs.setFloating}
      floatingStyles={floatingStyles}
      floatingX={x}
      floatingY={y}
    />;
  }

  return (
    <div
      key={id}
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        transition: shouldAnimate ? "all 0.3s ease-in-out" : "none",
      }}
    >
      {content}
    </div>
  );
};

interface FollowerProviderProps {
  children: ReactNode;
}
// This component is the root of the follower system. It manages the target elements and their followers.
export const FollowerProvider: React.FC<FollowerProviderProps> = ({ children }) => {
  // console.log("FollowerProvider rendered");
  // Store follower state data (inertialMode, springConfig) in a ref Map to avoid rerenders
  const followerStates = useRef<Map<string, FollowerState>>(new Map());

  // Store other data separately since they have special side effects
  const followTargets = useRef<Map<string, FollowTarget>>(new Map());
  const altTargets = useRef<Map<string, AltTarget>>(new Map());
  const followerContentRefs = useRef<Map<string, FollowerContent>>(new Map());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Store subscribers for target changes
  const targetSubscribers = useRef<Map<string, Set<(target: FollowTarget | null) => void>>>(new Map());

  // Store subscribers for altTarget changes
  const altTargetSubscribers = useRef<Map<string, Set<(altTarget: AltTarget | undefined) => void>>>(new Map());

  // Store subscribers for follower state changes
  const followerStateSubscribers = useRef<Map<string, Set<(state: FollowerState) => void>>>(new Map());

  // Store subscribers for follower content changes
  const followerContentSubscribers = useRef<Map<string, Set<(content: FollowerContent) => void>>>(new Map());

  // Track which followers are active
  const [activeFollowerIds, setActiveFollowerIds] = useState<Set<string>>(new Set());

  // setFollowerState function - accepts object or updater function like React useState
  const setFollowerState: SetFollowerState = useCallback((id: string, stateOrUpdater: FollowerState | FollowerStateUpdater) => {
    const currentState = followerStates.current.get(id) || {};
    const newState = typeof stateOrUpdater === 'function'
      ? stateOrUpdater(currentState)
      : stateOrUpdater; // React useState replaces the entire state, doesn't merge

    followerStates.current.set(id, newState);

    // Notify subscribers of the state change
    const subscribers = followerStateSubscribers.current.get(id);
    if (subscribers) {
      subscribers.forEach(callback => callback(newState));
    }
  }, []);

  // Specific setter for followerContent (has special side effects)
  const setFollowerContent = useCallback((id: string, content: ReactNode | null) => {
    if (content) {
      followerContentRefs.current.set(id, content);
      setActiveFollowerIds(prev => {
        if (prev.has(id)) return prev;
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    } else {
      followerContentRefs.current.delete(id);
      setActiveFollowerIds(prev => {
        if (!prev.has(id)) return prev;
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }

    // Notify subscribers of the content change
    const subscribers = followerContentSubscribers.current.get(id);
    if (subscribers) {
      subscribers.forEach(callback => callback(content));
    }
  }, []);

  // Specific setter for altTarget (has special side effects)
  const setAltTarget = useCallback((id: string, altTarget: AltTarget | undefined) => {
    if (altTarget) {
      altTargets.current.set(id, altTarget);
    } else {
      altTargets.current.delete(id);
    }

    // Notify subscribers of the altTarget change
    const subscribers = altTargetSubscribers.current.get(id);
    if (subscribers) {
      subscribers.forEach(callback => callback(altTarget));
    }
  }, []);

  // Specific setter for followTarget (has special side effects)
  const setTargetReference: SetRef = useCallback((id: string, followTargetElement: FollowTarget) => {
    // console.log("setTargetReference", id, !!followTargetElement);

    if (!followTargetElement) {
      // Element is being removed - set a timeout to clean up all associated data
      const timeoutId = setTimeout(() => {
        // console.log(`Cleaning up follower ${id} after 200ms timeout`);

        // Clean up all stored data for this follower
        followTargets.current.delete(id);
        altTargets.current.delete(id);
        followerStates.current.delete(id);
        followerContentRefs.current.delete(id);
        setActiveFollowerIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });

        // Clean up timeout reference
        timeoutRefs.current.delete(id);

        // Clean up subscribers
        targetSubscribers.current.delete(id);
        altTargetSubscribers.current.delete(id);
        followerStateSubscribers.current.delete(id);
        followerContentSubscribers.current.delete(id);
      }, 200);

      timeoutRefs.current.set(id, timeoutId);

      // Remove from followTargets immediately and notify subscribers
      followTargets.current.delete(id);
      const subscribers = targetSubscribers.current.get(id);
      if (subscribers) {
        subscribers.forEach(callback => callback(null));
      }
    } else {
      // Element is being registered - clear any existing timeout and register normally
      const existingTimeout = timeoutRefs.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutRefs.current.delete(id);
      }

      followTargets.current.set(id, followTargetElement);

      // Notify subscribers of the new target
      const subscribers = targetSubscribers.current.get(id);
      if (subscribers) {
        subscribers.forEach(callback => callback(followTargetElement));
      }
    }
  }, []);

  // Getter functions
  const getFollowerState = useCallback((id: string): FollowerState => {
    return followerStates.current.get(id) || {};
  }, []);

  const getFollowerContent = useCallback((id: string) => {
    return followerContentRefs.current.get(id);
  }, []);

  const getAltTarget = useCallback((id: string) => {
    return altTargets.current.get(id);
  }, []);

  // Subscribe to target changes for each follower
  const subscribeToTarget = useCallback((id: string, callback: (target: FollowTarget | null) => void) => {
    // Add subscriber
    if (!targetSubscribers.current.has(id)) {
      targetSubscribers.current.set(id, new Set());
    }
    targetSubscribers.current.get(id)!.add(callback);

    // Immediately call with current target
    const currentTarget = followTargets.current.get(id) || null;
    callback(currentTarget);

    // Return unsubscribe function
    return () => {
      const subscribers = targetSubscribers.current.get(id);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          targetSubscribers.current.delete(id);
        }
      }
    };
  }, []);

  // Subscribe to altTarget changes for each follower
  const subscribeToAltTarget = useCallback((id: string, callback: (altTarget: AltTarget | undefined) => void) => {
    // Add subscriber
    if (!altTargetSubscribers.current.has(id)) {
      altTargetSubscribers.current.set(id, new Set());
    }
    altTargetSubscribers.current.get(id)!.add(callback);

    // Immediately call with current altTarget
    const currentAltTarget = altTargets.current.get(id);
    callback(currentAltTarget);

    // Return unsubscribe function
    return () => {
      const subscribers = altTargetSubscribers.current.get(id);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          altTargetSubscribers.current.delete(id);
        }
      }
    };
  }, []);

  // Subscribe to follower state changes
  const subscribeFollowerState = useCallback((id: string, callback: (state: FollowerState) => void) => {
    // Add subscriber
    if (!followerStateSubscribers.current.has(id)) {
      followerStateSubscribers.current.set(id, new Set());
    }
    followerStateSubscribers.current.get(id)!.add(callback);

    // Immediately call with current state
    const currentState = followerStates.current.get(id) || {};
    callback(currentState);

    // Return unsubscribe function
    return () => {
      const subscribers = followerStateSubscribers.current.get(id);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          followerStateSubscribers.current.delete(id);
        }
      }
    };
  }, []);

  // Subscribe to follower content changes
  const subscribeToFollowerContent = useCallback((id: string, callback: (content: FollowerContent) => void) => {
    // Add subscriber
    if (!followerContentSubscribers.current.has(id)) {
      followerContentSubscribers.current.set(id, new Set());
    }
    followerContentSubscribers.current.get(id)!.add(callback);

    // Immediately call with current content
    const currentContent = followerContentRefs.current.get(id);
    callback(currentContent);

    // Return unsubscribe function
    return () => {
      const subscribers = followerContentSubscribers.current.get(id);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          followerContentSubscribers.current.delete(id);
        }
      }
    };
  }, []);

  const contextValue: FollowerCtxType = {
    setTargetReference,
    subscribeToTarget,
    subscribeToAltTarget,
    setFollowerContent,
    getFollowerContent,
    setAltTarget,
    getAltTarget,
    setFollowerState,
    getFollowerState,
    subscribeFollowerState,
    subscribeToFollowerContent,
    cleanupFollower: (id: string) => {
      // console.log("cleanupFollower", id);

      // Clear any existing timeout for this ID
      const existingTimeout = timeoutRefs.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutRefs.current.delete(id);
      }

      // Clean up all stored data for this follower
      followTargets.current.delete(id);
      altTargets.current.delete(id);
      followerStates.current.delete(id);
      followerContentRefs.current.delete(id);
      setActiveFollowerIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });

      // Clean up subscribers
      targetSubscribers.current.delete(id);
      altTargetSubscribers.current.delete(id);
      followerStateSubscribers.current.delete(id);
      followerContentSubscribers.current.delete(id);
    },
  };

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timeoutRefsValue = timeoutRefs.current;
      timeoutRefsValue.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutRefsValue.clear();
    };
  }, []);

  return (
    <FollowerCtx.Provider value={contextValue}>
      {children}
      {createPortal(
        <div>
          {Array.from(activeFollowerIds).map((id) => {
            return (
              <Follower
                key={id}
                id={id}
                subscribeToTarget={subscribeToTarget}
                subscribeToAltTarget={contextValue.subscribeToAltTarget}
                subscribeToFollowerContent={contextValue.subscribeToFollowerContent} />
            );
          })}
        </div>,
        document.body,
      )}
    </FollowerCtx.Provider>
  );
};

// Internal hook for connecting the Targer and Follower components via the Provider
const useFollowerTargetRef = <T extends HTMLElement>(id: string, children: ReactNode, altTarget?: AltTarget, useInertial?: boolean, springConfig?: { stiffness?: number; damping?: number; mass?: number }) => {
  const context = useContext(FollowerCtx);
  if (!context) throw new Error("Wrap your app with <FollowerProvider/>");
  const { setFollowerContent, setAltTarget, setFollowerState, setTargetReference } = context;

  // Send the children to get rendered in the portal
  useEffect(() => {
    setFollowerContent(id, children);
  }, [id, children, setFollowerContent]);

  // Forward the altTarget to the follower system
  useEffect(() => {
    setAltTarget(id, altTarget);
  }, [altTarget, id, setAltTarget]);

  // Set the inertial mode for this follower
  useEffect(() => {
    setFollowerState(id, (prev) => ({ ...prev, inertialMode: useInertial || false }));
  }, [useInertial, id, setFollowerState]);

  // Set the spring configuration for this follower
  useEffect(() => {
    setFollowerState(id, (prev) => ({ ...prev, springConfig: springConfig || {} }));
  }, [springConfig, id, setFollowerState]);

  // A callback ref that always re-points the follower to the latest DOM node
  const last = useRef<T | null>(null);
  const setTargetRef = useCallback((node: T | null) => {
    last.current = node;
    setTargetReference(id, node);
  }, [setTargetReference, id]);

  return setTargetRef;
}

interface FollowPortalProps<T extends HTMLElement> {
  id: string;
  TargetComponent?: React.FC<{ id: string, targetRef: Ref<T> }>;
  altTarget?: AltTarget;
  useInertial?: boolean;
  springConfig?: {
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  targetProps?: any;
  children: ReactNode;
}
// This component takes the children and forwards it to be rendered into its Follower, and renders the Target component as its real child.
export const FollowPortal = <T extends HTMLElement>({ id, TargetComponent, children, altTarget, useInertial, springConfig, targetProps }: FollowPortalProps<T>) => {
  // Send children to the follower system
  const targetRef = useFollowerTargetRef<T>(id, children, altTarget, useInertial, springConfig);
  // Mark the target with a ref
  return TargetComponent ? <TargetComponent key={`target-${id}`} id={id} targetRef={targetRef} {...targetProps} /> : null;
}
