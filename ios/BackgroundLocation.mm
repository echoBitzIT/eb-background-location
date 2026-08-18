#import "BackgroundLocation.h"
#import <React/RCTBridge.h>

#if __has_include("BackgroundLocation-Swift.h")
#import "BackgroundLocation-Swift.h"
#elif __has_include(<BackgroundLocation/BackgroundLocation-Swift.h>)
#import <BackgroundLocation/BackgroundLocation-Swift.h>
#endif

@implementation BackgroundLocation

@synthesize bridge = _bridge;

- (instancetype)init
{
  if (self = [super init]) {
    dispatch_async(dispatch_get_main_queue(), ^{
      NSLog(@"[EBBgLoc] iOS module init — configure emitters + recoverIfNeeded");
      [self configureEventEmitters];
      [[LocationManagerWrapper shared] recoverIfNeeded];
    });
  }
  return self;
}

- (void)configureEventEmitters
{
  __weak __typeof(self) weakSelf = self;

  [LocationManagerWrapper shared].onLocationUpdate = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"location" body:eventData];
  };

  [LocationManagerWrapper shared].onError = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"error" body:eventData];
  };

  [LocationManagerWrapper shared].onWarning = ^(NSDictionary *eventData) {
    [weakSelf emitEventWithName:@"warning" body:eventData];
  };
}

- (void)emitEventWithName:(NSString *)name body:(NSDictionary *)body
{
  NSLog(@"[EBBgLoc] emit event %@", name);
  if (_bridge) {
    [_bridge enqueueJSCall:@"RCTDeviceEventEmitter"
                    method:@"emit"
                      args:@[ name, body ?: [NSNull null] ]
                completion:nil];
  } else {
    NSLog(@"[EBBgLoc] skip emit %@: bridge is nil", name);
  }
}

- (void)startTracking:(NSString *)sessionId
              options:(JS::NativeBackgroundLocation::TrackingOptionsSpec &)options
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *perm = [[LocationManagerWrapper shared] checkLocationPermission];
    NSString *status = perm[@"status"];
    NSLog(@"[EBBgLoc] startTracking session=%@ permission=%@", sessionId, status);
    if ([status isEqualToString:@"denied"] || [status isEqualToString:@"blocked"]) {
      NSLog(@"[EBBgLoc] startTracking REJECT PERMISSION_DENIED");
      reject(
        @"PERMISSION_DENIED",
        @"Location permission is not granted. Request permission before starting tracking.",
        nil
      );
      return;
    }
    if ([status isEqualToString:@"whenInUse"]) {
      NSLog(@"[EBBgLoc] startTracking REJECT BACKGROUND_PERMISSION_REQUIRED");
      reject(
        @"BACKGROUND_PERMISSION_REQUIRED",
        @"Always location permission is required for background tracking. Grant 'Always' in settings.",
        nil
      );
      return;
    }

    double intervalMs = 30000;
    auto intervalOpt = options.intervalMs();
    if (intervalOpt.has_value()) {
      intervalMs = intervalOpt.value();
    }

    double distanceFilterM = 25;
    auto distanceOpt = options.distanceFilterM();
    if (distanceOpt.has_value()) {
      distanceFilterM = distanceOpt.value();
    }

    double maxLocationAgeMs = 60000;
    auto maxAgeOpt = options.maxLocationAgeMs();
    if (maxAgeOpt.has_value()) {
      maxLocationAgeMs = maxAgeOpt.value();
    }

    NSString *accuracy = @"high";
    NSString *accuracyOpt = options.accuracy();
    if (accuracyOpt != nil && accuracyOpt.length > 0) {
      accuracy = accuracyOpt;
    }

    NSLog(@"[EBBgLoc] startTracking interval=%.0f filter=%.0f maxAge=%.0f accuracy=%@", intervalMs, distanceFilterM, maxLocationAgeMs, accuracy);
    [self configureEventEmitters];
    [[LocationManagerWrapper shared] startTrackingWithSessionId:sessionId
                                                     intervalMs:intervalMs
                                                distanceFilterM:distanceFilterM
                                               maxLocationAgeMs:maxLocationAgeMs
                                                       accuracy:accuracy];
    resolve(nil);
  } @catch (NSException *exception) {
    NSLog(@"[EBBgLoc] startTracking error: %@", exception.reason);
    reject(@"START_TRACKING_ERROR", exception.reason, nil);
  }
}

- (void)stopTracking:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSLog(@"[EBBgLoc] stopTracking");
    [[LocationManagerWrapper shared] stopTracking];
    resolve(nil);
  } @catch (NSException *exception) {
    NSLog(@"[EBBgLoc] stopTracking error: %@", exception.reason);
    reject(@"STOP_TRACKING_ERROR", exception.reason, nil);
  }
}

- (void)isTracking:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *status = [[LocationManagerWrapper shared] isTracking];
    NSLog(@"[EBBgLoc] isTracking %@", status);
    resolve(status);
  } @catch (NSException *exception) {
    NSLog(@"[EBBgLoc] isTracking error: %@", exception.reason);
    reject(@"IS_TRACKING_ERROR", exception.reason, nil);
  }
}

- (void)getLocationPermissionStatus:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *status = [[LocationManagerWrapper shared] checkLocationPermission];
    resolve(status);
  } @catch (NSException *exception) {
    reject(@"GET_PERMISSION_STATUS_ERROR", exception.reason, nil);
  }
}

- (void)getSessionLocations:(NSString *)sessionId
                      limit:(NSNumber *)limit
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSInteger safeLimit = limit != nil ? [limit integerValue] : 500;
    NSArray<NSDictionary *> *rows =
      [[LocationManagerWrapper shared] getSessionLocationsWithSessionId:sessionId
                                                                  limit:(int)safeLimit];
    resolve(rows);
  } @catch (NSException *exception) {
    reject(@"GET_SESSION_LOCATIONS_ERROR", exception.reason, nil);
  }
}

- (void)clearSessionLocations:(NSString *)sessionId
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [[LocationManagerWrapper shared] clearSessionLocationsWithSessionId:sessionId];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"CLEAR_SESSION_LOCATIONS_ERROR", exception.reason, nil);
  }
}

- (void)requestLocationPermission:(BOOL)foregroundOnly
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"[EBBgLoc] requestLocationPermission foregroundOnly=%d", foregroundOnly);
  [[LocationManagerWrapper shared]
    requestLocationPermissionWithForegroundOnly:foregroundOnly
                                     completion:^(NSDictionary *result) {
                                       NSLog(@"[EBBgLoc] requestLocationPermission result %@", result);
                                       resolve(result);
                                     }];
}

- (void)requestNotificationPermission:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"[EBBgLoc] requestNotificationPermission iOS granted");
  resolve(@"granted");
}

- (void)addListener:(NSString *)eventName
{
}

- (void)removeListeners:(double)count
{
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
  (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBackgroundLocationSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"BackgroundLocation";
}

@end
