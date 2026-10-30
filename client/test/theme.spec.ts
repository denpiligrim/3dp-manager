import { describe, it, expect } from 'vitest'
import { getDesignTokens } from '@/theme'

describe('theme', () => {
  describe('getDesignTokens', () => {
    it('должен возвращать объект с palette, typography, shape и components для light mode', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens).toHaveProperty('palette')
      expect(tokens).toHaveProperty('typography')
      expect(tokens).toHaveProperty('shape')
      expect(tokens).toHaveProperty('components')
    })

    it('должен возвращать объект с palette, typography, shape и components для dark mode', () => {
      const tokens = getDesignTokens('dark')
      
      expect(tokens).toHaveProperty('palette')
      expect(tokens).toHaveProperty('typography')
      expect(tokens).toHaveProperty('shape')
      expect(tokens).toHaveProperty('components')
    })

    it('должен устанавливать правильный mode в palette', () => {
      const lightTokens = getDesignTokens('light')
      const darkTokens = getDesignTokens('dark')
      
      expect(lightTokens.palette.mode).toBe('light')
      expect(darkTokens.palette.mode).toBe('dark')
    })

    it('должен использовать lightPalette для light mode', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.palette.primary.main).toBe('#2463b4')
      expect(tokens.palette.background.default).toBe('#f4f7fb')
      expect(tokens.palette.background.paper).toBe('#ffffff')
    })

    it('должен использовать darkPalette для dark mode', () => {
      const tokens = getDesignTokens('dark')
      
      expect(tokens.palette.primary.main).toBe('#8abbff')
      expect(tokens.palette.background.default).toBe('#101925')
      expect(tokens.palette.background.paper).toBe('#182333')
    })

    it('должен устанавливать fontFamily', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.typography.fontFamily).toContain('"Inter"')
      expect(tokens.typography.fontFamily).toContain('system-ui')
    })

    it('должен устанавливать fontWeight для заголовков', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.typography.h1.fontWeight).toBe(700)
      expect(tokens.typography.h2.fontWeight).toBe(700)
      expect(tokens.typography.h3.fontWeight).toBe(600)
      expect(tokens.typography.h4.fontWeight).toBe(600)
      expect(tokens.typography.h5.fontWeight).toBe(600)
      expect(tokens.typography.h6.fontWeight).toBe(600)
    })

    it('должен устанавливать textTransform none для кнопок', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.typography.button.textTransform).toBe('none')
      expect(tokens.typography.button.fontWeight).toBe(600)
    })

    it('должен устанавливать borderRadius 12', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.shape.borderRadius).toBe(12)
    })

    it('должен настраивать MuiCssBaseline для кастомных скроллбаров', () => {
      const lightTokens = getDesignTokens('light')
      const darkTokens = getDesignTokens('dark')
      
      expect(lightTokens.components.MuiCssBaseline).toBeDefined()
      expect(darkTokens.components.MuiCssBaseline).toBeDefined()
      
      // Проверяем что styleOverrides существуют
      expect(lightTokens.components.MuiCssBaseline.styleOverrides).toBeDefined()
      expect(darkTokens.components.MuiCssBaseline.styleOverrides).toBeDefined()
    })

    it('должен настраивать MuiButton с borderRadius 9', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.components.MuiButton.styleOverrides.root.borderRadius).toBe(9)
      expect(tokens.components.MuiButton.styleOverrides.root.boxShadow).toBe('none')
    })

    it('должен настраивать MuiPaper без backgroundImage', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.components.MuiPaper.styleOverrides.root.backgroundImage).toBe('none')
    })

    it('должен настраивать MuiPaper с border в зависимости от mode', () => {
      const lightTokens = getDesignTokens('light')
      const darkTokens = getDesignTokens('dark')
      
      expect(lightTokens.components.MuiPaper.styleOverrides.elevation1.border).toBe('1px solid #dce4ef')
      expect(darkTokens.components.MuiPaper.styleOverrides.elevation1.border).toBe('1px solid #304054')
    })

    it('должен настраивать MuiOutlinedInput с правильными borderColor', () => {
      const lightTokens = getDesignTokens('light')
      const darkTokens = getDesignTokens('dark')
      
      expect(lightTokens.components.MuiOutlinedInput.styleOverrides.root['& .MuiOutlinedInput-notchedOutline'].borderColor).toBe('#dce4ef')
      expect(darkTokens.components.MuiOutlinedInput.styleOverrides.root['& .MuiOutlinedInput-notchedOutline'].borderColor).toBe('#304054')
    })

    it('должен применять backdropFilter при поддержке браузером и сохранять непрозрачный фон без неё', () => {
      const tokens = getDesignTokens('light')
      
      const root = tokens.components.MuiAppBar.styleOverrides.root
      expect(root.backgroundColor).toBe(tokens.palette.background.paper)
      expect(root['@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)))'].backdropFilter).toBe('blur(12px)')
      expect(tokens.components.MuiAppBar.styleOverrides.root.boxShadow).toBe('none')
    })

    it('должен настраивать MuiTableRow без border у последнего элемента', () => {
      const tokens = getDesignTokens('light')
      
      expect(tokens.components.MuiTableRow.styleOverrides.root['&:last-child td'].borderBottom).toBe(0)
    })
  })
})
