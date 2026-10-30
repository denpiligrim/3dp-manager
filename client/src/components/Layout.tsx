import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Dns, Hub, People, Settings, SwapHoriz, History } from '@mui/icons-material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import Header from './Header';
import Footer from './Footer';
import SecurityWarning from './SecurityWarning';
import { useSecureConnection } from '../utils/useSecureConnection';

const drawerWidth = 240;

const menuItems = [
  { text: 'Подписки', icon: <People />, path: '/' },
  { text: 'Ноды', icon: <Hub />, path: '/nodes' },
  { text: 'Relay серверы', icon: <SwapHoriz />, path: '/tunnels' },
  { text: 'Домены', icon: <Dns />, path: '/domains' },
  { text: 'Журнал', icon: <History />, path: '/journal' },
  { text: 'Настройки', icon: <Settings />, path: '/settings' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSecure } = useSecureConnection();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const drawerContent = (
    <Box sx={{ overflow: 'auto' }}>
      <Toolbar />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Header onMenuClick={handleDrawerToggle} isMobile={isMobile} />

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',
          overflowX: 'hidden',
        }}
      >
        <Toolbar />
        {!isSecure && <SecurityWarning />}
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
        <Footer isMobile={isMobile} />
      </Box>
    </Box>
  );
}
