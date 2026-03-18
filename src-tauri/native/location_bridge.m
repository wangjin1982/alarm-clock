#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

@interface AlarmClockLocationRequester : NSObject <CLLocationManagerDelegate>

@property(nonatomic, strong) CLLocationManager *manager;
@property(nonatomic, strong) CLGeocoder *geocoder;
@property(nonatomic, copy) NSString *resultJSON;
@property(nonatomic, assign) BOOL finished;
@property(nonatomic, assign) BOOL requestedLocationUpdate;

- (NSString *)requestLocationWithTimeout:(NSTimeInterval)timeout;

@end

@implementation AlarmClockLocationRequester

- (CLAuthorizationStatus)currentAuthorizationStatusForManager:(CLLocationManager *)manager {
    if (@available(macOS 11.0, *)) {
        return manager.authorizationStatus;
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    return [CLLocationManager authorizationStatus];
#pragma clang diagnostic pop
}

- (NSString *)jsonStringWithStatus:(NSString *)status
                              city:(NSString *)city
                          latitude:(NSNumber *)latitude
                         longitude:(NSNumber *)longitude
                          accuracy:(NSNumber *)accuracy
                             error:(NSString *)error {
    NSMutableDictionary *payload = [NSMutableDictionary dictionary];
    payload[@"status"] = status ?: @"unsupported";

    if (city.length > 0) {
        payload[@"city"] = city;
    }
    if (latitude != nil) {
        payload[@"latitude"] = latitude;
    }
    if (longitude != nil) {
        payload[@"longitude"] = longitude;
    }
    if (accuracy != nil) {
        payload[@"accuracy"] = accuracy;
    }
    if (error.length > 0) {
        payload[@"error"] = error;
    }

    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    if (data == nil) {
        return @"{\"status\":\"unsupported\",\"error\":\"无法序列化定位结果\"}";
    }

    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (void)finishWithStatus:(NSString *)status
                    city:(NSString *)city
                location:(CLLocation *)location
                   error:(NSString *)error {
    if (self.finished) {
        return;
    }

    self.finished = YES;
    [self.manager stopUpdatingLocation];
    [self.geocoder cancelGeocode];
    self.resultJSON = [self jsonStringWithStatus:status
                                            city:city
                                        latitude:location ? @(location.coordinate.latitude) : nil
                                       longitude:location ? @(location.coordinate.longitude) : nil
                                        accuracy:location ? @(location.horizontalAccuracy) : nil
                                           error:error];
}

- (NSString *)statusStringForAuthorizationStatus:(CLAuthorizationStatus)status {
    if (status == kCLAuthorizationStatusAuthorizedAlways ||
        status == kCLAuthorizationStatusAuthorized) {
        return @"granted";
    }

    if (status == kCLAuthorizationStatusDenied) {
        return @"denied";
    }

    if (status == kCLAuthorizationStatusRestricted) {
        return @"restricted";
    }

    return @"prompt";
}

- (NSString *)requestLocationWithTimeout:(NSTimeInterval)timeout {
    if (![CLLocationManager locationServicesEnabled]) {
        return [self jsonStringWithStatus:@"services-disabled"
                                  city:nil
                                 latitude:nil
                                longitude:nil
                                 accuracy:nil
                                    error:@"系统定位服务已关闭"];
    }

    self.finished = NO;
    self.resultJSON = nil;
    self.requestedLocationUpdate = NO;
    self.manager = [[CLLocationManager alloc] init];
    self.geocoder = [[CLGeocoder alloc] init];
    self.manager.delegate = self;
    self.manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters;

    CLAuthorizationStatus status = [self currentAuthorizationStatusForManager:self.manager];

    if (status == kCLAuthorizationStatusAuthorizedAlways ||
        status == kCLAuthorizationStatusAuthorized) {
        self.requestedLocationUpdate = YES;
        [self.manager startUpdatingLocation];
    } else if (status == kCLAuthorizationStatusNotDetermined) {
        [self.manager requestWhenInUseAuthorization];
    } else {
        return [self jsonStringWithStatus:[self statusStringForAuthorizationStatus:status]
                                  city:nil
                                 latitude:nil
                                longitude:nil
                                 accuracy:nil
                                    error:nil];
    }

    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout];
    while (!self.finished && deadline.timeIntervalSinceNow > 0) {
        @autoreleasepool {
            [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode
                                     beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];
        }
    }

    if (!self.finished) {
        return [self jsonStringWithStatus:@"unsupported"
                                  city:nil
                                 latitude:nil
                                longitude:nil
                                 accuracy:nil
                                    error:@"系统定位超时，请稍后重试"];
    }

    return self.resultJSON ?: [self jsonStringWithStatus:@"unsupported"
                                                    city:nil
                                                 latitude:nil
                                                longitude:nil
                                                 accuracy:nil
                                                    error:@"系统定位失败"];
}

- (void)handleAuthorizationChangeForManager:(CLLocationManager *)manager {
    CLAuthorizationStatus status = [self currentAuthorizationStatusForManager:manager];

    if (status == kCLAuthorizationStatusAuthorizedAlways ||
        status == kCLAuthorizationStatusAuthorized) {
        if (!self.requestedLocationUpdate) {
            self.requestedLocationUpdate = YES;
            [manager startUpdatingLocation];
        }
        return;
    }

    if (status == kCLAuthorizationStatusDenied ||
        status == kCLAuthorizationStatusRestricted) {
        [self finishWithStatus:[self statusStringForAuthorizationStatus:status]
                          city:nil
                      location:nil
                         error:nil];
    }
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager {
    [self handleAuthorizationChangeForManager:manager];
}

- (void)locationManager:(CLLocationManager *)manager didChangeAuthorizationStatus:(CLAuthorizationStatus)status {
    [self handleAuthorizationChangeForManager:manager];
}

- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations {
    CLLocation *location = nil;
    for (CLLocation *candidate in [locations reverseObjectEnumerator]) {
        if (candidate.horizontalAccuracy >= 0) {
            location = candidate;
            break;
        }
    }

    if (location == nil) {
        return;
    }

    [self.geocoder reverseGeocodeLocation:location completionHandler:^(NSArray<CLPlacemark *> * _Nullable placemarks, NSError * _Nullable error) {
        CLPlacemark *placemark = placemarks.firstObject;
        NSString *city = placemark.locality ?: placemark.subAdministrativeArea ?: placemark.administrativeArea;
        NSString *geocodeError = error == nil ? nil : error.localizedDescription;
        [self finishWithStatus:@"granted" city:city location:location error:geocodeError];
    }];
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error {
    if ([error.domain isEqualToString:kCLErrorDomain]) {
        if (error.code == kCLErrorDenied) {
            [self finishWithStatus:@"denied" city:nil location:nil error:nil];
            return;
        }

        if (error.code == kCLErrorLocationUnknown) {
            return;
        }

        if (error.code == kCLErrorNetwork) {
            [self finishWithStatus:@"unsupported"
                              city:nil
                          location:nil
                             error:@"定位网络暂时不可用，请稍后重试"];
            return;
        }
    }

    [self finishWithStatus:@"unsupported"
                      city:nil
                  location:nil
                     error:error.localizedDescription ?: @"系统定位失败"];
}

@end

static char *AlarmClockDuplicateCString(NSString *value) {
    if (value == nil) {
        return NULL;
    }

    const char *utf8 = value.UTF8String;
    if (utf8 == NULL) {
        return NULL;
    }

    size_t length = strlen(utf8);
    char *buffer = malloc(length + 1);
    if (buffer == NULL) {
        return NULL;
    }

    memcpy(buffer, utf8, length + 1);
    return buffer;
}

char *alarm_clock_request_location_json(double timeout_seconds) {
    __block NSString *result = nil;

    void (^work)(void) = ^{
        AlarmClockLocationRequester *requester = [[AlarmClockLocationRequester alloc] init];
        result = [requester requestLocationWithTimeout:timeout_seconds];
    };

    if ([NSThread isMainThread]) {
        work();
    } else {
        dispatch_sync(dispatch_get_main_queue(), work);
    }

    return AlarmClockDuplicateCString(result);
}

void alarm_clock_free_c_string(char *value) {
    if (value != NULL) {
        free(value);
    }
}
