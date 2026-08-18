#import <BackgroundLocationSpec/BackgroundLocationSpec.h>
#import <React/RCTBridgeModule.h>

@interface BackgroundLocation : NSObject <NativeBackgroundLocationSpec>

@property (nonatomic, weak) RCTBridge *bridge;

@end
