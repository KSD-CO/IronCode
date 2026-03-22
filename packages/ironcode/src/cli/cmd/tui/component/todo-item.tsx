import { useTheme } from "../context/theme"

export interface TodoItemProps {
  status: string
  content: string
}

export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme()

  const icon = () => {
    switch (props.status) {
      case "completed":
        return "\u2713"
      case "in_progress":
        return "\u25B6"
      case "cancelled":
        return "\u2717"
      default:
        return "\u25CB"
    }
  }

  const color = () => {
    switch (props.status) {
      case "completed":
        return theme.success
      case "in_progress":
        return theme.warning
      case "cancelled":
        return theme.error
      default:
        return theme.textMuted
    }
  }

  return (
    <box flexDirection="row" gap={1}>
      <text
        flexShrink={0}
        style={{
          fg: color(),
        }}
      >
        {icon()}
      </text>
      <text
        flexGrow={1}
        wrapMode="word"
        style={{
          fg: props.status === "in_progress" ? theme.text : theme.textMuted,
        }}
      >
        {props.content}
      </text>
    </box>
  )
}
