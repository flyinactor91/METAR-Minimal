#include <pebble.h>

//------------------------------------Key Definitions------------------------------------//

#define KEY_STATION 0
#define KEY_CONDITION 1
#define KEY_SUCCESS 2

#define UPDATE_INTERVAL 15 //minutes
#define FAIL_RETRY_INTERVAL 5 //minutes
#define FAIL_RECOG_INTERVAL 2 //minutes

//---------------------------------Pointer Declarations---------------------------------//
static Window *s_main_window;
//Layers
static TextLayer *s_time_layer;
static TextLayer *s_station_layer;
static TextLayer *s_condition_layer;

int updateTimer;
int failedUpdateTimer;

//--------------------------------Pebble UI Loading/Unloading--------------------------------//

static void main_window_load(Window *window) {
  //----Set Black Background----//
  window_set_background_color(window, GColorBlack);
  
  //----Current Time TextLayer----//
  #if defined(PBL_RECT)
  s_time_layer = text_layer_create(GRect(0, 8, 144, 50));
  #elif defined(PBL_ROUND)
  s_time_layer = text_layer_create(GRect(0, 20, 180, 50));
  #endif
  text_layer_set_background_color(s_time_layer, GColorClear);
  text_layer_set_text_color(s_time_layer, GColorWhite);
  text_layer_set_text(s_time_layer, "00:00");
  text_layer_set_font(s_time_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(s_time_layer, GTextAlignmentCenter);
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_time_layer));
  
  //----Station TextLayer----//
  #if defined(PBL_RECT)
  s_station_layer = text_layer_create(GRect(0, 58, 144, 50));
  #elif defined(PBL_ROUND)
  s_station_layer = text_layer_create(GRect(0, 63, 180, 50));
  #endif
  text_layer_set_background_color(s_station_layer, GColorClear);
  text_layer_set_text_color(s_station_layer, GColorWhite);
  text_layer_set_text(s_station_layer, "ICAO");
  text_layer_set_font(s_station_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(s_station_layer, GTextAlignmentCenter);
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_station_layer));
  
  //----Condition TextLayer----//
  #if defined(PBL_RECT)
  s_condition_layer = text_layer_create(GRect(0, 108, 144, 50));
  #elif defined(PBL_ROUND)
  s_condition_layer = text_layer_create(GRect(0, 106, 180, 50));
  #endif
  text_layer_set_background_color(s_condition_layer, GColorClear);
  text_layer_set_text_color(s_condition_layer, GColorWhite);
  text_layer_set_text(s_condition_layer, "....");
  text_layer_set_font(s_condition_layer, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(s_condition_layer, GTextAlignmentCenter);
  layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_condition_layer));
}

static void main_window_unload(Window *window) {
  //----Destroy TextLayers----//
  text_layer_destroy(s_time_layer);
  text_layer_destroy(s_station_layer);
  text_layer_destroy(s_condition_layer);
}

//--------------------------------Data Updating Functions--------------------------------//

static void update_time() {
  // Get a tm structure
  time_t temp = time(NULL); 
  struct tm *tick_time = localtime(&temp);

  // Create a long-lived buffer
  static char buffer[] = "00:00";

  // Write the current hours and minutes into the buffer
  if(clock_is_24h_style() == true) {
    // Use 24 hour format
    strftime(buffer, sizeof("00:00"), "%H:%M", tick_time);
  } else {
    // Use 12 hour format
    strftime(buffer, sizeof("00:00"), "%l:%M", tick_time);
  }

  // Display this time on the TextLayer
  text_layer_set_text(s_time_layer, buffer);
}

static void auto_update_handler() {
  //Call for updated data if reached UPDATE_INTERVAL
  if (updateTimer > UPDATE_INTERVAL + FAIL_RECOG_INTERVAL) {
    updateTimer = 0;
    APP_LOG(APP_LOG_LEVEL_INFO, "Reseting counter to 0");
    failedUpdateTimer = 0;
    
    //The phone won't read it, but we need a dict to execute the outbox call
    DictionaryIterator *iter;
    app_message_outbox_begin(&iter);
    dict_write_uint8(iter, 0, 0);
    app_message_outbox_send();
  } else {
    updateTimer++;
    failedUpdateTimer++;
    APP_LOG(APP_LOG_LEVEL_INFO, "Incremented counter");
  }
  if (failedUpdateTimer == FAIL_RECOG_INTERVAL) {
    APP_LOG(APP_LOG_LEVEL_INFO, "Set screen and counter to 3");
    failedUpdateTimer = FAIL_RECOG_INTERVAL + 1;
    updateTimer = UPDATE_INTERVAL - FAIL_RETRY_INTERVAL;
    text_layer_set_text(s_condition_layer, ":(");
    window_set_background_color(s_main_window, GColorBlack);
  }
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  update_time();
  auto_update_handler();
}

static void update_station(Tuple *t) {
  static char buffer[8];
  snprintf(buffer, sizeof(buffer), "%s", t->value->cstring);
  text_layer_set_text(s_station_layer, buffer);
  //layer_mark_dirty(text_layer_get_layer(s_station_layer));
}

static void update_condition(Tuple *t) {
  static char buffer[8];
  snprintf(buffer, sizeof(buffer), "%s", t->value->cstring);
  text_layer_set_text(s_condition_layer, buffer);
  #ifdef PBL_COLOR
  if (strcmp(buffer, "VFR") == 0) { window_set_background_color(s_main_window, GColorMayGreen); }
  else if (strcmp(buffer, "MVFR") == 0) { window_set_background_color(s_main_window, GColorPictonBlue); }
  else if (strcmp(buffer, "IFR") == 0) { window_set_background_color(s_main_window, GColorRoseVale); }
  else if (strcmp(buffer, "LIFR") == 0) { window_set_background_color(s_main_window, GColorLavenderIndigo); }
  else { window_set_background_color(s_main_window, GColorBlack); }
  #endif
}

static void update_success_background(Tuple *t) {
  bool success = t->value->uint8;
  if (!success) {
    window_set_background_color(s_main_window, GColorBlack);
  }
  //Else determined by update_condition
}

//---------------------------------App Messege Callbacks---------------------------------//

static void inbox_received_callback(DictionaryIterator *iterator, void *context) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Updating Watch Display Elements");
  
   // Read first item
  Tuple *t = dict_read_first(iterator);

  // For all items
  while(t != NULL) {
    // Which key was received?
    switch(t->key) {
    case KEY_STATION:
      update_station(t);
      break;
    case KEY_CONDITION:
      update_condition(t);
      break;
    case KEY_SUCCESS:
      update_success_background(t);
      break;
    default:
      APP_LOG(APP_LOG_LEVEL_ERROR, "Key %d not recognized!", (int)t->key);
      break;
    }

    // Look for next item
    t = dict_read_next(iterator);
  }
  APP_LOG(APP_LOG_LEVEL_INFO, "Setting to 3 after successful update");
  failedUpdateTimer = FAIL_RECOG_INTERVAL + 1;
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Message dropped!");
}

static void outbox_failed_callback(DictionaryIterator *iterator, AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed!");
}

static void outbox_sent_callback(DictionaryIterator *iterator, void *context) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Outbox send success!");
}

//-----------------------------------Init Deinit and Main-----------------------------------//

static void init() {
  updateTimer = 0;
  failedUpdateTimer = 0;
  
  // Create main Window element and assign to pointer
  s_main_window = window_create();

  // Set handlers to manage the elements inside the Window
  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
    .unload = main_window_unload
  });

  // Show the Window on the watch, with animated=true
  window_stack_push(s_main_window, true);
  
  //Update the clock time before window load
  update_time();
  
  // Register with TickTimerService
  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
  
  // Register callbacks
  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  app_message_register_outbox_sent(outbox_sent_callback);
  
  // Open AppMessage
  app_message_open(400, 0);
}

static void deinit() {
  // Destroy Window
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}