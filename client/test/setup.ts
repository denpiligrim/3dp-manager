import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import './mocks'

// Очищать DOM после каждого теста
afterEach(() => {
  cleanup()
})

// Подавляем шумные console.log/console.error во время тестов
// Оставляем только важные ошибки через test.skip()
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // Фильтруем шумные логи от приложений
  console.log = (...args) => {
    const message = args.join(' ')
    // Пропускаем логи от компонентов которые шумят
    if (
      message.includes('[Tunnels]') ||
      message.includes('[Settings]') ||
      message.includes('[API]') ||
      message.includes('[Login]') ||
      message.includes('[AuthContext]') ||
      message.includes('[AxiosInterceptor]') ||
      message.includes('[Rotation]') ||
      message.includes('[Domains]') ||
      message.includes('[Subs]') ||
      message.includes('[Scanner]')
    ) {
      return
    }
    originalConsoleLog(...args)
  }

  // Подавляем console.warn для известных предупреждений
  console.warn = (...args) => {
    const message = args.join(' ')
    if (
      message.includes('[Tunnels]') ||
      message.includes('[Settings]') ||
      message.includes('[AuthContext]') ||
      message.includes('[AxiosInterceptor]') ||
      message.includes('[Domains]') ||
      message.includes('[Subs]') ||
      message.includes('[Scanner]')
    ) {
      return
    }
    originalConsoleWarn(...args)
  }

  // Подавляем console.error для известных предупреждений React
  console.error = (...args) => {
    const message = args.join(' ')
    // Пропускаем предупреждения act(...) - они не критичны
    if (
      message.includes('act(...)') ||
      message.includes('An update to') ||
      message.includes('Not implemented: navigation to another Document') ||
      message.includes('[Login]') ||
      message.includes('[Settings]') ||
      message.includes('[AuthContext]') ||
      message.includes('[AxiosInterceptor]') ||
      message.includes('[Subs]')
    ) {
      return
    }
    originalConsoleError(...args)
  }
})

afterAll(() => {
  // Восстанавливаем console после всех тестов
  console.log = originalConsoleLog
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Мок для MUI icons-material - используем vi.mock с factory
vi.mock('@mui/icons-material', async () => {
  const React = await import('react')
  
  const createIconMock = (name: string) => {
    const IconMock = (props: Record<string, unknown>) => {
      return React.createElement('span', { 
        'data-testid': `icon-${name}`,
        ...props 
      }, name)
    }
    IconMock.displayName = name
    return IconMock
  }

  // Создаем мок для всех иконок
  const mock: Record<string, unknown> = {}
  const icons = [
    'GitHub', 'YouTube', 'Telegram', 'Brightness7', 'Brightness4', 'BrightnessAuto',
    'Logout', 'HelpOutline', 'Menu', 'People', 'Settings', 'Dns', 'SwapHoriz',
    'Delete', 'Add', 'Terminal', 'CheckCircle', 'Error', 'LinkIcon', 'OpenInNew',
    'ContentCopy', 'Router', 'Edit', 'MoreVert', 'Remove', 'Refresh', 'Search',
    'FilterList', 'Warning', 'Info', 'Close', 'Check', 'ArrowDownward', 'ArrowUpward',
    'MoreHoriz', 'ContentPaste', 'QrCode', 'Usb', 'VpnKey', 'Security', 'Speed',
    'Timeline', 'Assessment', 'SettingsApplications', 'CloudDownload', 'CloudUpload',
    'Folder', 'FileCopy', 'Save', 'Print', 'DeleteOutline', 'Restore', 'History',
    'Schedule', 'AccessTime', 'Today', 'Event', 'Notifications', 'AccountCircle',
    'Person', 'Group', 'Public', 'Language', 'Translate', 'Star', 'Favorite',
    'Home', 'LocationOn', 'Place', 'Email', 'Phone', 'Chat', 'Message', 'Forum',
    'Share', 'Send', 'Inbox', 'Drafts', 'Mail', 'Markunread', 'Lock', 'LockOpen',
    'Unlock', 'Visibility', 'VisibilityOff', 'ToggleOn', 'ToggleOff',
    'RadioButtonChecked', 'RadioButtonUnchecked', 'CheckBox', 'CheckBoxOutlineBlank',
    'PlusOne', 'ThumbUp', 'ThumbDown', 'Whatshot', 'FavoriteBorder', 'StarBorder',
    'Bookmark', 'BookmarkBorder', 'Bookmarks', 'TurnedIn', 'TurnedInNot', 'Label',
    'LabelImportant', 'Grade', 'Done', 'Clear', 'Block', 'Stop', 'Pause', 'PlayArrow',
    'FastForward', 'FastRewind', 'SkipNext', 'SkipPrevious', 'FiberManualRecord',
    'Circle', 'NavigateNext', 'NavigateBefore', 'ChevronRight', 'ChevronLeft',
    'ExpandMore', 'ExpandLess', 'UnfoldMore', 'UnfoldLess', 'ArrowRight', 'ArrowLeft',
    'ArrowBack', 'ArrowForward', 'ArrowDropDown', 'ArrowDropUp', 'Expand',
    'FileDownload', 'FileUpload', 'UploadFile', 'Download', 'Attachment', 'Link', 'InsertLink', 'Photo',
    'Image', 'PictureAsPdf', 'ImageIcon', 'CameraAlt', 'Videocam', 'Movie',
    'MusicNote', 'Mic', 'VolumeUp', 'VolumeOff', 'Headset', 'Headphones', 'Speaker',
    'Radio', 'Podcasts', 'Tv', 'DesktopWindows', 'Laptop', 'Computer', 'Tablet',
    'Smartphone', 'PhoneIphone', 'PhoneAndroid', 'Devices', 'SmartDisplay', 'Monitor',
    'ScreenShare', 'StopScreenShare', 'PresentToAll', 'Cast', 'CastConnected',
    'Wifi', 'WifiOff', 'NetworkWifi', 'NetworkCell', 'SignalCellular4Bar',
    'SignalWifi4Bar', 'Bluetooth', 'BluetoothConnected', 'BluetoothDisabled',
    'GpsFixed', 'GpsNotFixed', 'LocationSearching', 'MyLocation', 'Navigation',
    'NearMe', 'Directions', 'DirectionsCar', 'DirectionsBus', 'DirectionsTrain',
    'DirectionsBike', 'DirectionsWalk', 'DirectionsRun', 'Flight', 'LocalAirport',
    'Hotel', 'Restaurant', 'LocalCafe', 'LocalBar', 'LocalPizza', 'BrunchDining',
    'DinnerDining', 'LunchDining', 'Nightlife', 'LocalHospital', 'LocalPharmacy',
    'ShoppingBag', 'ShoppingCart', 'ShoppingBasket', 'Store', 'Shop', 'Storefront',
    'LocalMall', 'AccountBalance', 'Business', 'CorporateFare', 'Work', 'MeetingRoom',
    'Gite', 'House', 'Cottage', 'Apartment', 'Villa', 'OtherHouses', 'Foundation',
    'Fence', 'Yard', 'Pool', 'HotTub', 'Spa', 'FitnessCenter', 'SportsGymnasium',
    'SportsBasketball', 'SportsFootball', 'SportsSoccer', 'SportsTennis',
    'SportsVolleyball', 'SportsBaseball', 'SportsCricket', 'SportsGolf', 'SportsHockey',
    'SportsMma', 'SportsMotorsports', 'SportsRugby', 'SportsScore', 'SportsHandball',
    'SportsKabaddi', 'Rowing', 'Surfing', 'Kitesurfing', 'Snowboarding',
    'DownhillSkiing', 'Snowshoeing', 'IceSkating', 'Curling', 'Sailing', 'Kayaking',
    'Rafting', 'ScubaDiving', 'Diving', 'Fishing', 'Hiking', 'RunningWithErrors',
    'PlayCircleFilled', 'PauseCircleFilled', 'RefreshTwoTone', 'SubdirectoryArrowRight',
    'SubdirectoryArrowLeft', 'SettingsInputComponent', 'SettingsInputComponentOutlined',
    'Dns', 'Hub', 'Sync',
  ]

  icons.forEach(name => {
    mock[name] = createIconMock(name)
  })

  mock.default = createIconMock('DefaultIcon')
  return mock
})
